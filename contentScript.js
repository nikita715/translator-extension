/*
   Copyright 2019 - 2024 Nikita Stepochkin

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

document.body.addEventListener('dblclick', function(e) {
  let text = window.getSelection().toString();
  sendToTranslate(e, "dbclick", text);
});

document.body.addEventListener('click', function(e) {
  if (e.detail === 3) {
    let text = window.getSelection().toString();
    sendToTranslate(e, "tpclick", text);
  }
});

// After the extension is reloaded or updated, scripts left in already open tabs lose the connection to it
function isExtensionConnected() {
  return Boolean(chrome.runtime && chrome.runtime.id);
}

function sendToTranslate(e, action, text) {
  if (!isBlank(text) && notInputTag(e.target) && isExtensionConnected()) {
    chrome.runtime.sendMessage({
      action: action,
      type: "translate",
      altActive: e.altKey,
      text
    });
  }
}

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

document.onkeyup = function(e) {
  if (e.altKey && isExtensionConnected()) {
    if (e.which == 49) {
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: "none"
      });
    } else if (e.which == 50) {
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: "dbclick"
      });
    } else if (e.which == 51) {
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: "tpclick"
      });
    }
  }
};

function notInputTag(element) {
  let tagName = element.tagName;
  return tagName != "INPUT" && tagName != "TEXTAREA" && tagName != "OPTION";
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type == "translateBuiltIn") {
    let segments = request.replaceText ? getReplaceableSegments() : null;
    if (segments) {
      replaceWithTranslation(segments, request.sourceLanguage, request.targetLanguage, request.engine).then(function() {
        sendResponse({ success: true });
      }).catch(function(error) {
        logBuiltInFallback(error, request.googleFallback);
        if (!request.googleFallback) {
          showTranslationPopup(chrome.i18n.getMessage("translationFailed"));
        }
        sendResponse({ success: false });
      });
      return true;
    }
    let popup = showTranslationPopup(chrome.i18n.getMessage("translating"));
    translateOnPage([request.text], request.sourceLanguage, request.targetLanguage, request.engine, function(progress) {
      popup.setText(chrome.i18n.getMessage("downloadingModel", [String(Math.round(progress * 100))]));
    }).then(function([translation]) {
      popup.setText(translation);
      sendResponse({ success: true });
    }).catch(function(error) {
      logBuiltInFallback(error, request.googleFallback);
      if (request.googleFallback) {
        popup.close();
      } else {
        popup.setText(chrome.i18n.getMessage("translationFailed"));
      }
      sendResponse({ success: false });
    });
    return true;
  } else if (request.type == "engineProgress") {
    let onProgress = engineProgressListeners.get(request.requestId);
    if (onProgress) {
      onProgress(request.progress);
    }
  }
});

// An unsupported language pair is an expected case, not an error
function logBuiltInFallback(error, googleFallback) {
  let next = googleFallback ? ", opening Google Translate" : "";
  if (error.name == "NotSupportedError") {
    console.debug(`Translator: language pair isn't supported on the page${next}`);
  } else {
    console.debug(`Translator: built-in translation failed${next}`, error);
  }
}

// Bergamot runs in the extension's offscreen document, Chrome's translator runs in the page
async function translateOnPage(texts, sourceLanguage, targetLanguage, engine, onDownloadProgress) {
  if (!engine || engine == "chrome") {
    return translateBuiltIn(texts, sourceLanguage, targetLanguage, onDownloadProgress);
  }
  if (sourceLanguage == "auto") {
    sourceLanguage = fromDetectedLanguage(await detectLanguage(texts.join(" ")));
  }
  if (isSameLanguage(sourceLanguage, targetLanguage)) {
    return texts;
  }
  let requestId = String(Math.random());
  engineProgressListeners.set(requestId, onDownloadProgress);
  try {
    let response = await chrome.runtime.sendMessage({
      type: "translateWithEngine",
      engine,
      texts,
      sourceLanguage,
      targetLanguage,
      requestId
    });
    if (!response || response.error) {
      let error = response ? response.error : { name: "Error", message: "No response from the translation engine" };
      throw new DOMException(error.message, error.name);
    }
    return response.translations;
  } finally {
    engineProgressListeners.delete(requestId);
  }
}

let engineProgressListeners = new Map();

// Language Detector returns BCP 47 tags, the engines take Google Translate codes
let detectedLanguageCodes = {
  "fil": "tl",
  "he": "iw",
  "jv": "jw",
  "nb": "no",
  "zh": "zh-CN",
  "zh-Hant": "zh-TW"
};

function fromDetectedLanguage(code) {
  return detectedLanguageCodes[code] || code;
}

let translators = new Map();

async function translateBuiltIn(texts, sourceLanguage, targetLanguage, onDownloadProgress) {
  if (!("Translator" in self)) {
    throw new Error("Translator API is not supported");
  }
  targetLanguage = toBuiltInLanguageCode(targetLanguage);
  sourceLanguage = sourceLanguage == "auto" ?
    await detectLanguage(texts.join(" ")) :
    toBuiltInLanguageCode(sourceLanguage);
  if (isSameLanguage(sourceLanguage, targetLanguage)) {
    return texts;
  }
  let key = `${sourceLanguage}:${targetLanguage}`;
  if (!translators.has(key)) {
    translators.set(key, createTranslator(sourceLanguage, targetLanguage, onDownloadProgress));
  }
  try {
    let translator = await translators.get(key);
    return await Promise.all(texts.map(function(text) {
      return translator.translate(text);
    }));
  } catch (error) {
    translators.delete(key);
    throw error;
  }
}

// The detector returns "fr" for Canadian French text, and Chrome has no "fr" -> "fr-CA" model: the text is already
// in the target language. Chinese is the exception, Simplified -> Traditional is a real translation
function isSameLanguage(sourceLanguage, targetLanguage) {
  let sourceBase = sourceLanguage.split("-")[0];
  let targetBase = targetLanguage.split("-")[0];
  return sourceLanguage == targetLanguage || (sourceBase == targetBase && sourceBase != "zh");
}

// Text nodes covered by the current selection; null when the selection can't be replaced in place
function getReplaceableSegments() {
  let selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) {
    return null;
  }
  let range = selection.getRangeAt(0);
  let root = range.commonAncestorContainer;
  let rootElement = root.nodeType == Node.TEXT_NODE ? root.parentElement : root;
  if (!rootElement || rootElement.isContentEditable) {
    return null;
  }

  let nodes = [];
  if (root.nodeType == Node.TEXT_NODE) {
    nodes.push(root);
  } else {
    let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        let parentTag = node.parentElement ? node.parentElement.tagName : "";
        if (parentTag == "SCRIPT" || parentTag == "STYLE" || parentTag == "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        // A selection can span hidden text, e.g. the other language version of a paragraph
        if (node.parentElement && !node.parentElement.checkVisibility()) {
          return NodeFilter.FILTER_REJECT;
        }
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
  }

  let segments = [];
  nodes.forEach(function(node) {
    let start = node == range.startContainer ? range.startOffset : 0;
    let end = node == range.endContainer ? range.endOffset : node.length;
    if (isBlank(node.data.slice(start, end))) {
      return;
    }
    // Isolate the selected part of the node so only it gets replaced
    if (end < node.length) {
      node.splitText(end);
    }
    segments.push(start > 0 ? node.splitText(start) : node);
  });
  return segments.length ? segments : null;
}

async function replaceWithTranslation(segments, sourceLanguage, targetLanguage, engine) {
  let popup = null;
  try {
    let translations = await translateOnPage(segments.map(function(node) {
      return node.data.trim();
    }), sourceLanguage, targetLanguage, engine, function(progress) {
      popup = popup || showTranslationPopup("");
      popup.setText(chrome.i18n.getMessage("downloadingModel", [String(Math.round(progress * 100))]));
    });
    let group = String(++replacedGroupCount);
    segments.forEach(function(node, i) {
      // Translating a translation again still restores the very first original
      if (!originalTexts.has(node)) {
        originalTexts.set(node, node.data);
      }
      // Keep surrounding whitespace so words don't stick to neighbouring nodes
      let leading = node.data.match(/^\s*/)[0];
      let trailing = node.data.match(/\s*$/)[0];
      node.data = leading + translations[i] + trailing;
      markReplaced(node, group);
    });
    updateGroupEdges(group);
    placeRestoreButton(group);
    window.getSelection().removeAllRanges();
  } finally {
    if (popup) {
      popup.close();
    }
  }
}

// Replaced text is framed and followed by a button that restores the original
let replacedGroupCount = 0;
let originalTexts = new WeakMap();
let replacedTag = "translator-replaced";

function markReplaced(node, group) {
  let mark = node.parentElement;
  if (!mark || mark.localName != replacedTag) {
    addReplacedStyle();
    mark = document.createElement(replacedTag);
    node.replaceWith(mark);
    mark.appendChild(node);
  }
  let previousGroup = mark.dataset.group;
  mark.dataset.group = group;
  if (previousGroup) {
    updateGroupEdges(previousGroup);
    placeRestoreButton(previousGroup);
  }
}

// Text nodes are framed one by one, so only the outer sides of the first and last get a border
// and the fragment looks like a single frame
function updateGroupEdges(group) {
  let marks = getReplacedGroup(group);
  marks.forEach(function(mark, i) {
    mark.toggleAttribute("data-first", i == 0);
    mark.toggleAttribute("data-last", i == marks.length - 1);
  });
}

function addReplacedStyle() {
  if (document.getElementById("translator-replaced-style")) {
    return;
  }
  let style = document.createElement("style");
  style.id = "translator-replaced-style";
  style.textContent = `
    ${replacedTag} {
      display: inline;
      border-block: 1px dashed rgba(26, 115, 232, 0.7);
    }
    ${replacedTag}[data-first] {
      margin-inline-start: -2px;
      padding-inline-start: 1px;
      border-inline-start: 1px dashed rgba(26, 115, 232, 0.7);
      border-start-start-radius: 3px;
      border-end-start-radius: 3px;
    }
    ${replacedTag}[data-last] {
      margin-inline-end: -2px;
      padding-inline-end: 1px;
      border-inline-end: 1px dashed rgba(26, 115, 232, 0.7);
      border-start-end-radius: 3px;
      border-end-end-radius: 3px;
    }`;
  (document.head || document.documentElement).appendChild(style);
}

function getReplacedGroup(group) {
  return Array.from(document.querySelectorAll(`${replacedTag}[data-group="${group}"]`));
}

function restoreOriginal(group) {
  getReplacedGroup(group).forEach(function(mark) {
    mark.childNodes.forEach(function(node) {
      if (originalTexts.has(node)) {
        node.data = originalTexts.get(node);
        originalTexts.delete(node);
      }
    });
    mark.replaceWith(...mark.childNodes);
  });
  placeRestoreButton(group);
}

let restoreTag = "translator-restore";

// The restore button sits in the text flow right after the fragment, so it never covers any text
function placeRestoreButton(group) {
  document.querySelectorAll(`${restoreTag}[data-group="${group}"]`).forEach(function(button) {
    button.remove();
  });
  let marks = getReplacedGroup(group);
  if (!marks.length) {
    return;
  }
  let host = document.createElement(restoreTag);
  host.dataset.group = group;
  host.style.cssText = "display: inline-block; margin-inline-start: 4px; vertical-align: baseline;";
  let shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      button {
        display: block;
        width: 18px;
        height: 18px;
        padding: 0;
        border: 1px solid rgba(26, 115, 232, 0.5);
        border-radius: 50%;
        background: #fff;
        color: #1a73e8;
        font: 600 12px/16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        text-align: center;
        cursor: pointer;
      }
      button:hover {
        background: #e8f0fe;
      }
    </style>
    <button type="button">↺</button>`;
  let button = shadow.querySelector("button");
  let label = chrome.i18n.getMessage("restoreOriginal");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", function(e) {
    // The fragment may be inside a link
    e.preventDefault();
    e.stopPropagation();
    restoreOriginal(group);
  });
  marks[marks.length - 1].after(host);
}


async function createTranslator(sourceLanguage, targetLanguage, onDownloadProgress) {
  let availability = await Translator.availability({ sourceLanguage, targetLanguage });
  if (availability == "unavailable") {
    throw new DOMException(`Language pair ${sourceLanguage} -> ${targetLanguage} is unavailable`, "NotSupportedError");
  }
  return Translator.create({
    sourceLanguage,
    targetLanguage,
    monitor(m) {
      m.addEventListener("downloadprogress", function(e) {
        onDownloadProgress(e.loaded);
      });
    }
  });
}

let languageDetector = null;

async function detectLanguage(text) {
  if (!("LanguageDetector" in self)) {
    throw new DOMException("Language Detector API is not supported", "NotSupportedError");
  }
  if (!languageDetector) {
    languageDetector = LanguageDetector.create();
  }
  let results;
  try {
    results = await (await languageDetector).detect(text);
  } catch (error) {
    languageDetector = null;
    throw error;
  }
  let language = results.length ? results[0].detectedLanguage : "und";
  if (language == "und") {
    throw new DOMException("Unable to detect language", "NotSupportedError");
  }
  return language;
}

let translationPopupHost = null;

function showTranslationPopup(text) {
  closeTranslationPopup();

  let host = document.createElement("div");
  host.style.cssText = "position: absolute; z-index: 2147483647; top: 0; left: 0;";
  let shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .popup {
        max-width: 360px;
        padding: 8px 12px;
        border-radius: 6px;
        background: #fff;
        color: #202124;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    </style>
    <div class="popup" dir="auto"></div>`;
  let content = shadow.querySelector(".popup");
  content.textContent = text;

  let selection = window.getSelection();
  let rect = selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
  if (rect && (rect.width || rect.height)) {
    host.style.top = `${rect.bottom + window.scrollY + 6}px`;
    host.style.left = `${rect.left + window.scrollX}px`;
  } else {
    host.style.position = "fixed";
    host.style.top = "16px";
    host.style.left = "16px";
  }

  document.documentElement.appendChild(host);
  translationPopupHost = host;

  return {
    setText(value) {
      content.textContent = value;
    },
    close() {
      if (translationPopupHost == host) {
        closeTranslationPopup();
      }
    }
  };
}

function closeTranslationPopup() {
  if (translationPopupHost) {
    translationPopupHost.remove();
    translationPopupHost = null;
  }
}

document.addEventListener("mousedown", function(e) {
  if (translationPopupHost && !translationPopupHost.contains(e.target)) {
    closeTranslationPopup();
  }
});

document.addEventListener("keydown", function(e) {
  if (e.key == "Escape") {
    closeTranslationPopup();
  }
});
