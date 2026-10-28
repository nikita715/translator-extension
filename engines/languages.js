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

// Which languages Bergamot supports, shared by the popup and engines/offscreen.js.
// All functions take Google Translate language codes.

// Google Translate codes that differ from the ones Firefox Translations models use
let bergamotLanguageCodes = {
  "iw": "he",
  "no": "nb",
  "zh-CN": "zh",
  "zh-TW": "zh_hant"
};

function toBergamotLanguageCode(code) {
  return bergamotLanguageCodes[code] || code;
}

// Mozilla's public model registry. Firefox itself downloads models from a CDN that rejects other browsers
let bergamotStorageUrl = "https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/";
let bergamotRegistryUrl = bergamotStorageUrl + "db/models.json";
// Optional host permission the popup requests when Bergamot is selected: the storage sends no CORS headers
let bergamotModelsOrigin = bergamotStorageUrl + "*";
let bergamotReleaseStatuses = ["Release", "Release Desktop"];
// Serbo-Croatian model translates each of these languages to English
let bergamotSerboCroatian = ["sr", "hr", "bs"];
let bergamotModelsPromise = null;
// Firefox's settings service lists the same models and, unlike the storage, can be read without access to it
let bergamotRemoteSettingsUrl = "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-models/records?_fields=fromLang,toLang";
let bergamotRemotePairsPromise = null;

// "from-to" (Firefox codes) -> { from, to, files } of the release model, files are
// { model, lex, vocab } or { model, lex, srcvocab, trgvocab }, each { url, size, sha256 } of the unpacked file
function loadBergamotModels() {
  if (!bergamotModelsPromise) {
    bergamotModelsPromise = fetch(bergamotRegistryUrl, { credentials: "omit" }).catch(function(error) {
      throw new DOMException(`Loading Bergamot models failed: ${error.message}`, "NetworkError");
    }).then(function(response) {
      if (!response.ok) {
        throw new DOMException(`Loading Bergamot models failed: HTTP ${response.status}`, "NetworkError");
      }
      return response.json();
    }).then(function(json) {
      let models = new Map();
      Object.values(json.models).forEach(function(entries) {
        let entry = entries.find(function(entry) {
          return bergamotReleaseStatuses.includes(entry.releaseStatus);
        });
        if (!entry) {
          return;
        }
        let files = {};
        Object.entries({ model: "model", lex: "lexicalShortlist", vocab: "vocab", srcvocab: "srcVocab", trgvocab: "trgVocab" })
          .forEach(function([part, key]) {
            let file = entry.files[key];
            if (file) {
              files[part] = {
                // Files are gzipped, the engine reads options from the unpacked file name
                url: json.baseUrl + "/" + file.path + "#" + file.path.split("/").pop().replace(/\.gz$/, ""),
                size: file.uncompressedSize || 0,
                sha256: file.uncompressedHash
              };
            }
          });
        if (files.model && files.lex && (files.vocab || (files.srcvocab && files.trgvocab))) {
          models.set(`${entry.sourceLanguage}-${entry.targetLanguage}`, { from: entry.sourceLanguage, to: entry.targetLanguage, files });
        }
      });
      let serboCroatian = models.get("hbs-en");
      if (serboCroatian) {
        bergamotSerboCroatian.forEach(function(language) {
          if (!models.has(`${language}-en`)) {
            models.set(`${language}-en`, { ...serboCroatian, from: language });
          }
        });
      }
      return models;
    }).catch(function(error) {
      bergamotModelsPromise = null;
      throw error;
    });
  }
  return bergamotModelsPromise;
}

// "from-to" pairs Bergamot translates. Without access to the storage they come from the settings service
async function loadBergamotPairs() {
  try {
    return new Set((await loadBergamotModels()).keys());
  } catch (error) {
    if (!bergamotRemotePairsPromise) {
      bergamotRemotePairsPromise = fetch(bergamotRemoteSettingsUrl, { credentials: "omit" }).then(function(response) {
        if (!response.ok) {
          throw new DOMException(`Loading Bergamot pairs failed: HTTP ${response.status}`, "NetworkError");
        }
        return response.json();
      }).then(function(json) {
        let pairs = new Set(json.data.map(function(record) {
          return `${record.fromLang}-${record.toLang}`;
        }));
        if (pairs.has("hbs-en")) {
          bergamotSerboCroatian.forEach(function(language) {
            pairs.add(`${language}-en`);
          });
        }
        return pairs;
      }).catch(function(remoteError) {
        bergamotRemotePairsPromise = null;
        throw remoteError;
      });
    }
    return bergamotRemotePairsPromise;
  }
}

function findBergamotRoute(pairs, source, target) {
  let from = toBergamotLanguageCode(source);
  let to = toBergamotLanguageCode(target);
  if (pairs.has(`${from}-${to}`)) {
    return [{ from, to }];
  }
  if (from != "en" && to != "en" && pairs.has(`${from}-en`) && pairs.has(`en-${to}`)) {
    return [{ from, to: "en" }, { from: "en", to }];
  }
  return null;
}

async function getBergamotRoute(source, target) {
  return findBergamotRoute(new Set((await loadBergamotModels()).keys()), source, target);
}

// Whether the engine can translate source -> target
async function isEnginePairSupported(engine, source, target) {
  if (engine == "bergamot") {
    return Boolean(findBergamotRoute(await loadBergamotPairs(), source, target));
  }
  return false;
}
