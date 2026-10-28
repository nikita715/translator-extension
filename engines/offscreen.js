/*
   Copyright 2019 - 2026 Nikita Stepochkin

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

// Offline translation engine Bergamot (Firefox Translations).
// background.js forwards translation requests from content scripts here.

import { BatchTranslator, TranslatorBacking } from "../vendor/bergamot/translator.js";

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.target != "offscreen" || message.type != "translateWithEngine") {
    return;
  }
  resetIdleTimer();
  let onProgress = throttle(function(progress) {
    chrome.runtime.sendMessage({
      type: "engineProgress",
      tabId: message.tabId,
      requestId: message.requestId,
      progress
    }).catch(function() {});
  }, 200);
  engines[message.engine].translate(message.texts, message.sourceLanguage, message.targetLanguage, onProgress)
    .then(function(translations) {
      sendResponse({ translations });
    }).catch(function(error) {
      console.debug(`Translator: ${message.engine} translation failed`, error);
      sendResponse({ error: { name: error.name, message: error.message } });
    });
  return true;
});

// Models take a lot of memory, so the document asks to be closed when it hasn't been used for a while
let idleTimer = null;

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(function() {
    chrome.runtime.sendMessage({ type: "offscreenIdle" }).catch(function() {});
  }, 10 * 60 * 1000);
}

function throttle(fn, interval) {
  let last = 0;
  return function(value) {
    let now = Date.now();
    if (now - last >= interval || value >= 1) {
      last = now;
      fn(value);
    }
  };
}

function unsupported(source, target) {
  return new DOMException(`Language pair ${source} -> ${target} is unavailable`, "NotSupportedError");
}

// Sum of all files being downloaded, as a fraction
class DownloadProgress {
  constructor(onProgress) {
    this.files = new Map();
    this.onProgress = onProgress;
  }

  update(file, loaded, total) {
    this.files.set(file, [loaded, total]);
    let sum = [0, 0];
    this.files.forEach(function([fileLoaded, fileTotal]) {
      sum[0] += fileLoaded;
      sum[1] += fileTotal;
    });
    if (sum[1]) {
      this.onProgress(sum[0] / sum[1]);
    }
  }
}

/* Bergamot */

// Firefox Translations models instead of the package's registry, kept in Cache Storage between sessions
class FirefoxModelsBacking extends TranslatorBacking {
  async loadModelRegistery() {
    let models = await loadBergamotModels();
    return Array.from(models.values(), function({ from, to, files }) {
      let registryFiles = {};
      Object.entries(files).forEach(function([part, file]) {
        registryFiles[part] = { name: file.url, size: file.size, expectedSha256Hash: file.sha256 };
      });
      return { from, to, files: registryFiles };
    });
  }

  async fetch(url, checksum) {
    let cache = await caches.open("bergamot-models");
    let cached = await cache.match(url);
    if (cached) {
      return cached.arrayBuffer();
    }
    let response = await fetch(url, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`Downloading ${url} failed: HTTP ${response.status}`);
    }
    // Progress counts the gzipped bytes being downloaded
    let total = Number(response.headers.get("Content-Length"));
    let reader = response.body.getReader();
    let chunks = [];
    let loaded = 0;
    for (;;) {
      let { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      loaded += value.length;
      if (bergamotDownload && total) {
        bergamotDownload.update(url, loaded, total);
      }
    }
    let buffer = await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    if (checksum && await sha256(buffer) != checksum) {
      throw new Error(`Checksum mismatch for ${url}`);
    }
    await cache.put(url, new Response(buffer));
    return buffer;
  }
}

async function sha256(buffer) {
  let digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), function(byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

let bergamotTranslator = null;
let bergamotRouteKey = null;
let bergamotDownload = null;
// One request at a time: a request for another language pair replaces the worker
let bergamotQueue = Promise.resolve();

// The engine never unloads models and its WASM memory runs out after 4-5 of them,
// so the worker keeps only the models of the current pair and is replaced when the pair changes.
// Models are loaded again from Cache Storage, that takes about a second
function getBergamotTranslator(route) {
  let routeKey = JSON.stringify(route);
  if (bergamotTranslator && bergamotRouteKey != routeKey) {
    resetBergamotTranslator();
  }
  if (!bergamotTranslator) {
    bergamotTranslator = new BatchTranslator({ pivotLanguage: "en" }, new FirefoxModelsBacking({ pivotLanguage: "en" }));
    bergamotRouteKey = routeKey;
  }
  return bergamotTranslator;
}

function resetBergamotTranslator() {
  if (bergamotTranslator) {
    bergamotTranslator.delete();
    bergamotTranslator = null;
  }
}

async function translateWithBergamot(texts, from, to, route) {
  let translator = getBergamotTranslator(route);
  let responses = await Promise.all(texts.map(function(text) {
    return translator.translate({ from, to, text, html: false });
  }));
  return responses.map(function(response) {
    return response.target.text;
  });
}

let bergamot = {
  async translate(texts, source, target, onProgress) {
    let route = await getBergamotRoute(source, target);
    if (!route) {
      throw unsupported(source, target);
    }
    let from = toBergamotLanguageCode(source);
    let to = toBergamotLanguageCode(target);
    let run = bergamotQueue.then(async function() {
      bergamotDownload = new DownloadProgress(onProgress);
      try {
        return await translateWithBergamot(texts, from, to, route);
      } catch (error) {
        // A crashed worker stays broken, start a new one and try once more
        console.debug("Translator: restarting Bergamot after an error", error);
        resetBergamotTranslator();
        return await translateWithBergamot(texts, from, to, route);
      }
    });
    bergamotQueue = run.catch(function() {});
    return run;
  }
};

let engines = { bergamot };
