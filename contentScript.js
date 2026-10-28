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
    // When a download has to be confirmed the popup takes over, Google Translate isn't opened after that
    let responded = false;
    let respond = function(response) {
      if (!responded) {
        responded = true;
        sendResponse(response);
      }
    };
    let segments = request.replaceText ? getReplaceableSegments() : null;
    if (segments) {
      let onConfirmDownload = request.askBeforeDownload ? function() {
        respond({ success: true });
      } : null;
      replaceWithTranslation(segments, request.sourceLanguage, request.targetLanguage, request.engine, onConfirmDownload).then(function() {
        respond({ success: true });
      }).catch(function(error) {
        let fallback = request.googleFallback && !responded;
        logBuiltInFallback(error, fallback);
        if (!fallback) {
          showTranslationPopup(getErrorMessage(error));
        }
        respond({ success: false });
      });
      return true;
    }
    let popup = showTranslationPopup(chrome.i18n.getMessage("translating"));
    // Only the latest translation updates the popup when another language is picked before the first one ends
    let attempt = 0;
    let translate = function(sourceLanguage) {
      let current = ++attempt;
      // Google Translate opens only instead of the very first translation, not after a choice in the popup
      let isFirst = current == 1;
      popup.setText(chrome.i18n.getMessage("translating"));
      translateOnPage([request.text], sourceLanguage, request.targetLanguage, request.engine, {
        onDownloadProgress(progress) {
          if (current == attempt) {
            popup.setText(chrome.i18n.getMessage("downloadingModel", [String(Math.round(progress * 100))]));
          }
        },
        onDetected(languages, selected) {
          popup.setLanguages(languages, selected, translate);
        },
        // The translation shows up at once, other languages may need a download
        preferDownloaded: true,
        confirmDownload: request.askBeforeDownload ? function(message) {
          respond({ success: true });
          return popup.confirm(message, chrome.i18n.getMessage("download"));
        } : null
      }).then(function([translation]) {
        if (current == attempt) {
          popup.setText(translation);
        }
        respond({ success: true });
      }).catch(function(error) {
        // A language picked in the popup is being translated already
        if (current != attempt) {
          respond({ success: true });
          return;
        }
        let fallback = isFirst && request.googleFallback && !responded;
        logBuiltInFallback(error, fallback);
        if (fallback) {
          popup.close();
        } else {
          popup.setText(getErrorMessage(error));
        }
        respond({ success: false });
      });
    };
    translate(request.sourceLanguage);
    return true;
  } else if (request.type == "engineProgress") {
    let onProgress = engineProgressListeners.get(request.requestId);
    if (onProgress) {
      onProgress(request.progress);
    }
  }
});

// Errors that explain to users why the text wasn't translated carry userMessage
function userError(name, message, userMessage) {
  let error = new DOMException(message, name);
  error.userMessage = userMessage;
  return error;
}

function getErrorMessage(error) {
  if (error.userMessage) {
    return error.userMessage;
  }
  return chrome.i18n.getMessage(error.name == "NetworkError" ? "modelDownloadFailed" : "translationFailed");
}

let engineNames = {
  chrome: "Chrome",
  bergamot: "Bergamot"
};

function getPairName(sourceLanguage, targetLanguage) {
  return `${getLanguageName(sourceLanguage) || sourceLanguage} → ${getLanguageName(targetLanguage) || targetLanguage}`;
}

// Error for languages none of the engines translates
function unsupportedError(message, engines) {
  let userMessage = engines.length == 1 ?
    chrome.i18n.getMessage("engineUnsupported", [engineNames[engines[0]]]) :
    chrome.i18n.getMessage("enginesUnsupported");
  return userError("NotSupportedError", message, userMessage);
}

// An unsupported language pair is an expected case, not an error
function logBuiltInFallback(error, googleFallback) {
  let next = googleFallback ? ", opening Google Translate" : "";
  if (error.name == "NotSupportedError") {
    console.debug(`Translator: language pair isn't supported on the page${next}`);
  } else {
    console.debug(`Translator: built-in translation failed${next}`, error);
  }
}

// Bergamot runs in the extension's offscreen document, Chrome's translator runs in the page.
// Languages both engines translate go to defaultEngine, the rest to the engine that translates them. Options:
// - onDownloadProgress(fraction) while a model downloads;
// - onDetected(languages, selected) for "auto": Google Translate codes of the likely languages an engine
//   can translate and the one that is used, the first one unless preferDownloaded;
// - preferDownloaded: for "auto" use the most likely language whose model is downloaded already;
// - confirmDownload(message) returns a promise that resolves when the user allows downloading a model
async function translateOnPage(texts, sourceLanguage, targetLanguage, defaultEngine, options = {}) {
  let { onDownloadProgress, onDetected, preferDownloaded, confirmDownload } = options;
  let engines = await getEngineOrder(defaultEngine || "chrome");
  if (!engines.length) {
    throw userError("NotSupportedError", "Translator API is not supported", chrome.i18n.getMessage("builtInUnavailable"));
  }
  let engine;
  if (sourceLanguage == "auto") {
    if (confirmDownload && await getDetectorAvailability() == "downloadable") {
      await confirmDownload(chrome.i18n.getMessage("detectorDownloadNeeded"));
    }
    let detected = await detectLanguages(texts.join(" "), targetLanguage);
    // The page's language goes last when an engine supports it and it isn't offered yet
    let pageLanguage = getPageLanguage(targetLanguage);
    let candidates = pageLanguage && !detected.includes(pageLanguage) ? detected.concat(pageLanguage) : detected;
    let supportedBy = await Promise.all(engines.map(function(candidateEngine) {
      return filterSupportedLanguages(candidateEngine, candidates, targetLanguage).catch(function() {
        return [];
      });
    }));
    let supported = candidates.filter(function(language) {
      return supportedBy.some(function(languages) {
        return languages.includes(language);
      });
    });
    let languages = supported.slice(0, maxLanguageChoices);
    if (pageLanguage && supported.includes(pageLanguage) && !languages.includes(pageLanguage)) {
      languages.push(pageLanguage);
    }
    if (!languages.length) {
      throw unsupportedError("None of the likely languages can be translated", engines);
    }
    let engineFor = function(language) {
      return engines[supportedBy.findIndex(function(languages) {
        return languages.includes(language);
      })];
    };
    sourceLanguage = languages[0];
    if (preferDownloaded) {
      for (let language of languages) {
        if (await isDownloaded(engineFor(language), language, targetLanguage)) {
          sourceLanguage = language;
          break;
        }
      }
    }
    engine = engineFor(sourceLanguage);
    if (onDetected) {
      onDetected(languages, sourceLanguage);
    }
  }
  if (isSameLanguage(sourceLanguage, targetLanguage)) {
    return texts;
  }
  engine = engine || await pickEngine(engines, sourceLanguage, targetLanguage);
  if (!engine) {
    throw unsupportedError(`Language pair ${sourceLanguage} -> ${targetLanguage} is unavailable`, engines);
  }
  if (confirmDownload) {
    let message = await getDownloadMessage(engine, sourceLanguage, targetLanguage);
    if (message) {
      await confirmDownload(message);
    }
  }
  try {
    return await translateWithEngine(texts, sourceLanguage, targetLanguage, engine, onDownloadProgress);
  } catch (error) {
    if (error.name == "NotSupportedError" && !error.userMessage) {
      throw unsupportedError(error.message, [engine]);
    }
    throw error;
  }
}

// The default engine and then the others this page can use: Chrome's needs the Translator API,
// Bergamot needs access to Mozilla's model storage
async function getEngineOrder(defaultEngine) {
  let response = await chrome.runtime.sendMessage({ type: "getEngineOrder", engine: defaultEngine }).catch(function() {
    return null;
  });
  let engines = response ? response.engines : [defaultEngine];
  return engines.filter(function(engine) {
    return engine != "chrome" || "Translator" in self;
  });
}

// Whether the pair translates without downloading a model
async function isDownloaded(engine, sourceLanguage, targetLanguage) {
  if (isSameLanguage(sourceLanguage, targetLanguage)) {
    return true;
  }
  try {
    return !await getDownloadMessage(engine, sourceLanguage, targetLanguage);
  } catch (e) {
    return false;
  }
}

// The first engine that translates the pair, null when none does
async function pickEngine(engines, sourceLanguage, targetLanguage) {
  for (let engine of engines) {
    try {
      if ((await checkEngineLanguages(engine, [sourceLanguage], targetLanguage))[0]) {
        return engine;
      }
    } catch (e) {
      // Bergamot's model list doesn't load offline
    }
  }
  return null;
}

async function translateWithEngine(texts, sourceLanguage, targetLanguage, engine, onDownloadProgress) {
  if (engine == "chrome") {
    return translateBuiltIn(texts, sourceLanguage, targetLanguage, onDownloadProgress);
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

async function getDetectorAvailability() {
  try {
    return "LanguageDetector" in self ? await LanguageDetector.availability() : "unavailable";
  } catch (e) {
    return "unavailable";
  }
}

// Warning for the popup when translating the pair needs a model download, null when the model is there
async function getDownloadMessage(engine, sourceLanguage, targetLanguage) {
  let pair = getPairName(sourceLanguage, targetLanguage);
  if (!engine || engine == "chrome") {
    let availability;
    try {
      availability = await Translator.availability({
        sourceLanguage: toBuiltInLanguageCode(sourceLanguage),
        targetLanguage: toBuiltInLanguageCode(targetLanguage)
      });
    } catch (e) {
      return null;
    }
    // Chrome doesn't tell the size of its language packs
    return availability == "downloadable" ? chrome.i18n.getMessage("downloadNeeded", [pair]) : null;
  }
  let response = await chrome.runtime.sendMessage({
    type: "checkEngineDownload",
    engine,
    sourceLanguage,
    targetLanguage
  });
  if (!response || !response.size) {
    return null;
  }
  let megabytes = String(Math.max(1, Math.round(response.size / 1e6)));
  return chrome.i18n.getMessage("downloadNeededSize", [pair, megabytes]);
}

// Keeps the languages the engine can translate into targetLanguage, in the same order. The target language itself
// stays: the text is already in it
async function filterSupportedLanguages(engine, languages, targetLanguage) {
  let toCheck = languages.filter(function(language) {
    return !isSameLanguage(language, targetLanguage);
  });
  let supported = toCheck.length ? await checkEngineLanguages(engine, toCheck, targetLanguage) : [];
  return languages.filter(function(language) {
    let i = toCheck.indexOf(language);
    return i == -1 || supported[i];
  });
}

async function checkEngineLanguages(engine, languages, targetLanguage) {
  if (!engine || engine == "chrome") {
    return Promise.all(languages.map(async function(language) {
      try {
        return await Translator.availability({
          sourceLanguage: toBuiltInLanguageCode(language),
          targetLanguage: toBuiltInLanguageCode(targetLanguage)
        }) != "unavailable";
      } catch (e) {
        return false;
      }
    }));
  }
  let response = await chrome.runtime.sendMessage({
    type: "checkEngineLanguages",
    engine,
    sourceLanguages: languages,
    targetLanguage
  });
  if (!response || response.error) {
    let error = response ? response.error : { name: "Error", message: "No response from the translation engine" };
    throw new DOMException(error.message, error.name);
  }
  return response.supported;
}

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

// Same names as the popup's language lists, empty for languages the extension doesn't list
function getLanguageName(code) {
  return chrome.i18n.getMessage("lang_" + code.replace(/-/g, "_"));
}

let translators = new Map();

// Languages are Google Translate codes, "auto" is resolved by translateOnPage
async function translateBuiltIn(texts, sourceLanguage, targetLanguage, onDownloadProgress) {
  if (!("Translator" in self)) {
    throw new Error("Translator API is not supported");
  }
  targetLanguage = toBuiltInLanguageCode(targetLanguage);
  sourceLanguage = toBuiltInLanguageCode(sourceLanguage);
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

// onConfirmDownload is called when a download is asked about, without it models download without asking
async function replaceWithTranslation(segments, sourceLanguage, targetLanguage, engine, onConfirmDownload) {
  let detectedLanguages = [];
  let usedLanguage = null;
  let translations = await translateInPlace(segments.map(function(node) {
    return node.data.trim();
  }), sourceLanguage, targetLanguage, engine, onConfirmDownload, function(languages, selected) {
    detectedLanguages = languages;
    usedLanguage = selected;
  });
  let group = String(++replacedGroupCount);
  segments.forEach(function(node, i) {
    // Translating a translation again still restores the very first original
    if (!originalTexts.has(node)) {
      originalTexts.set(node, node.data);
    }
    node.data = keepWhitespace(node.data, translations[i]);
    markReplaced(node, group);
  });
  updateGroupEdges(group);
  // Several likely source languages get a button to translate the fragment from another one
  if (detectedLanguages.length > 1) {
    let choices = {
      languages: detectedLanguages,
      // The picked language, its translation may be still in progress
      selected: usedLanguage,
      // While the picked language's model downloads, the button shows "…" and the fragment its original
      pending: false,
      // The language the fragment was last translated from and that translation
      shown: usedLanguage,
      shownTranslations: translations,
      attempt: 0,
      pick(language) {
        // Only the latest pick changes the text, a download nobody confirmed is dropped
        let current = ++choices.attempt;
        let isCurrent = function() {
          return current == choices.attempt;
        };
        closeTranslationPopup();
        choices.selected = language;
        choices.pending = false;
        placeRestoreButton(group);
        retranslateGroup(group, language, targetLanguage, engine, onConfirmDownload, isCurrent, function() {
          choices.pending = true;
          setGroupTexts(group, null);
          placeRestoreButton(group);
        }).then(function(newTranslations) {
          if (!isCurrent()) {
            return;
          }
          choices.pending = false;
          if (newTranslations) {
            choices.shown = language;
            choices.shownTranslations = newTranslations;
          } else {
            choices.selected = choices.shown;
          }
          setGroupTexts(group, choices.shownTranslations);
          placeRestoreButton(group);
        });
      }
    };
    groupLanguages.set(group, choices);
  }
  placeRestoreButton(group);
  window.getSelection().removeAllRanges();
}

function getGroupNodes(group) {
  return getReplacedGroup(group).flatMap(function(mark) {
    return Array.from(mark.childNodes).filter(function(node) {
      return originalTexts.has(node);
    });
  });
}

// Puts translations into a replaced fragment, null puts the originals back while keeping the fragment
function setGroupTexts(group, translations) {
  getGroupNodes(group).forEach(function(node, i) {
    let original = originalTexts.get(node);
    node.data = translations ? keepWhitespace(original, translations[i]) : original;
  });
}

// Keep surrounding whitespace so words don't stick to neighbouring nodes
function keepWhitespace(text, translation) {
  return text.match(/^\s*/)[0] + translation + text.match(/\s*$/)[0];
}

// translateOnPage for replacing text: the popup shows up only for download progress and confirmation.
// For "auto" a language with a downloaded model is preferred. onDownload() is called once a model has to be downloaded
async function translateInPlace(texts, sourceLanguage, targetLanguage, engine, onConfirmDownload, onDetected, onDownload) {
  let downloading = false;
  let notifyDownload = function() {
    if (!downloading && onDownload) {
      onDownload();
    }
    downloading = true;
  };
  let popup = null;
  let getPopup = function() {
    popup = popup || showTranslationPopup("");
    return popup;
  };
  try {
    return await translateOnPage(texts, sourceLanguage, targetLanguage, engine, {
      onDownloadProgress(progress) {
        notifyDownload();
        getPopup().setText(chrome.i18n.getMessage("downloadingModel", [String(Math.round(progress * 100))]));
      },
      onDetected,
      // Replaced text has no language buttons next to it until it's translated, so don't wait for a download
      preferDownloaded: true,
      confirmDownload: onConfirmDownload ? function(message) {
        onConfirmDownload();
        notifyDownload();
        return getPopup().confirm(message, chrome.i18n.getMessage("download"));
      } : null
    });
  } finally {
    if (popup) {
      popup.close();
    }
  }
}

// Translates the originals of a replaced fragment from another source language, resolves with the translations
// or null when it failed. isCurrent() is false when another language was picked meanwhile
async function retranslateGroup(group, sourceLanguage, targetLanguage, engine, onConfirmDownload, isCurrent, onDownload) {
  let nodes = getGroupNodes(group);
  let originals = nodes.map(function(node) {
    return originalTexts.get(node);
  });
  // Popups are placed at the selection
  let range = document.createRange();
  range.setStartBefore(nodes[0]);
  range.setEndAfter(nodes[nodes.length - 1]);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  try {
    return await translateInPlace(originals.map(function(text) {
      return text.trim();
    }), sourceLanguage, targetLanguage, engine, onConfirmDownload, null, function() {
      if (isCurrent()) {
        onDownload();
      }
    });
  } catch (error) {
    logBuiltInFallback(error, false);
    if (isCurrent()) {
      showTranslationPopup(getErrorMessage(error));
    }
    return null;
  } finally {
    if (isCurrent()) {
      window.getSelection().removeAllRanges();
    }
  }
}

// Replaced text is framed and followed by a button that restores the original
let replacedGroupCount = 0;
let originalTexts = new WeakMap();
// Group -> { languages, selected, pick(language) } for fragments translated from a detected language
let groupLanguages = new Map();
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
  groupLanguages.delete(group);
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
    groupLanguages.delete(group);
    return;
  }
  let host = document.createElement(restoreTag);
  host.dataset.group = group;
  host.style.cssText = "display: inline-block; position: relative; margin-inline-start: 4px; vertical-align: baseline;";
  let shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .buttons {
        display: flex;
        gap: 3px;
      }
      .restore,
      .language {
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
      .language {
        width: auto;
        min-width: 18px;
        padding: 0 5px;
        border-radius: 9px;
        font-size: 10px;
        text-transform: uppercase;
      }
      .restore:hover,
      .language:hover,
      .menu button:hover {
        background: #e8f0fe;
      }
      .menu {
        position: absolute;
        z-index: 2147483647;
        top: calc(100% + 4px);
        inset-inline-start: 0;
        min-width: 120px;
        padding: 4px 0;
        border-radius: 6px;
        background: #fff;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
      }
      .menu[hidden] {
        display: none;
      }
      .menu button {
        display: block;
        width: 100%;
        padding: 4px 12px;
        border: none;
        background: #fff;
        color: #202124;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        text-align: start;
        white-space: nowrap;
        cursor: pointer;
      }
      .menu button[aria-checked="true"] {
        color: #1a73e8;
        font-weight: 600;
      }
    </style>
    <div class="buttons"><button type="button" class="restore">↺</button></div>`;
  let button = shadow.querySelector(".restore");
  let label = chrome.i18n.getMessage("restoreOriginal");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", function(e) {
    // The fragment may be inside a link
    e.preventDefault();
    e.stopPropagation();
    restoreOriginal(group);
  });
  let languages = groupLanguages.get(group);
  if (languages) {
    addLanguageMenu(shadow, languages);
  }
  marks[marks.length - 1].after(host);
}

// Button with the source language before the restore button, it opens the list of the other likely languages
function addLanguageMenu(shadow, choices) {
  let toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "language";
  toggle.textContent = choices.pending ? "…" : choices.selected.split("-")[0];
  toggle.title = `${chrome.i18n.getMessage("sourceLanguageLabel")} ${getLanguageName(choices.selected)}`;
  toggle.setAttribute("aria-haspopup", "menu");
  let menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  let closeOnOutsideClick = function(e) {
    if (!e.composedPath().includes(menu) && !e.composedPath().includes(toggle)) {
      setOpen(false);
    }
  };
  let setOpen = function(open) {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      document.addEventListener("click", closeOnOutsideClick, true);
    } else {
      document.removeEventListener("click", closeOnOutsideClick, true);
    }
  };
  choices.languages.forEach(function(language) {
    let item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(language == choices.selected));
    item.textContent = getLanguageName(language);
    item.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      if (language != choices.selected) {
        choices.pick(language);
      }
    });
    menu.appendChild(item);
  });
  toggle.addEventListener("click", function(e) {
    // The fragment may be inside a link
    e.preventDefault();
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  shadow.querySelector(".buttons").prepend(toggle);
  shadow.appendChild(menu);
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

// Short texts are often misdetected: "задача" is Ukrainian 0.39, Bulgarian 0.26, Belarusian 0.24.
// Below this confidence the language of the whole paragraph around the selection goes first
let confidentDetection = 0.7;
// Languages the popup offers, the first one is selected
let maxLanguageChoices = 4;
let minChoiceConfidence = 0.05;

// Likely languages of the text as Google Translate codes, most likely first: the detected language,
// the paragraph's language and other candidates. The target language is kept only when it's the most likely
async function detectLanguages(text, targetLanguage) {
  if (!("LanguageDetector" in self)) {
    throw userError("NotSupportedError", "Language Detector API is not supported", chrome.i18n.getMessage("detectorUnavailable"));
  }
  let results = await detect(text);
  let paragraph = getSelectionParagraph();
  let paragraphResults = paragraph && paragraph.trim() != text.trim() ? await detect(paragraph) : [];
  let ranked = paragraphResults.slice(0, 1).concat(results);
  if (results[0].confidence >= confidentDetection || !paragraphResults.length ||
      paragraphResults[0].confidence <= results[0].confidence) {
    ranked.unshift(results[0]);
  }
  let languages = [];
  ranked.forEach(function(result) {
    let language = fromDetectedLanguage(result.detectedLanguage);
    if (result.detectedLanguage != "und" && result.confidence >= minChoiceConfidence &&
        !languages.includes(language) && getLanguageName(language) &&
        (!languages.length || !isSameLanguage(language, targetLanguage))) {
      languages.push(language);
    }
  });
  if (!languages.length) {
    throw userError("NotSupportedError", "Unable to detect language", chrome.i18n.getMessage("languageNotDetected"));
  }
  return languages;
}

async function detect(text) {
  if (!languageDetector) {
    languageDetector = LanguageDetector.create();
  }
  try {
    let results = await (await languageDetector).detect(text);
    return results.length ? results : [{ detectedLanguage: "und", confidence: 0 }];
  } catch (error) {
    languageDetector = null;
    throw error;
  }
}

// Google Translate code of the page's language from <html lang>, null when it's missing, unknown or the target
function getPageLanguage(targetLanguage) {
  let locale;
  try {
    locale = new Intl.Locale(document.documentElement.lang);
  } catch (e) {
    return null;
  }
  let language;
  if (locale.language == "zh") {
    let traditional = locale.script == "Hant" || ["TW", "HK", "MO"].includes(locale.region);
    language = traditional ? "zh-TW" : "zh-CN";
  } else if (locale.region && getLanguageName(`${locale.language}-${locale.region}`)) {
    // Regional languages Google lists separately, like pt-PT or fr-CA
    language = `${locale.language}-${locale.region}`;
  } else {
    language = fromDetectedLanguage(locale.language);
  }
  if (!getLanguageName(language) || isSameLanguage(language, targetLanguage)) {
    return null;
  }
  return language;
}

// Text of the block around the selection: a paragraph, list item, table cell, heading or the text field
function getSelectionParagraph() {
  let active = document.activeElement;
  if (active && (active.tagName == "INPUT" || active.tagName == "TEXTAREA")) {
    return active.value;
  }
  let selection = window.getSelection();
  if (!selection.rangeCount) {
    return "";
  }
  let node = selection.getRangeAt(0).commonAncestorContainer;
  let element = node.nodeType == Node.ELEMENT_NODE ? node : node.parentElement;
  while (element && element != document.body && getComputedStyle(element).display.startsWith("inline")) {
    element = element.parentElement;
  }
  return element ? element.innerText : "";
}

let translationPopupHost = null;
let translationPopupCleanup = null;

function showTranslationPopup(text) {
  closeTranslationPopup();

  let host = document.createElement("div");
  // Fixed and moved on every scroll: pages often scroll an inner container, not the window
  host.style.cssText = "position: fixed; z-index: 2147483647; top: 16px; left: 16px;";
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
        word-wrap: break-word;
      }
      .content {
        white-space: pre-wrap;
      }
      .languages:empty {
        display: none;
      }
      .action {
        display: block;
        margin-top: 6px;
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        background: #1a73e8;
        color: #fff;
        font: inherit;
        cursor: pointer;
      }
      .action:hover {
        background: #1765cc;
      }
      .languages {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        margin-bottom: 6px;
        color: #5f6368;
        font-size: 12px;
      }
      .languages button {
        padding: 1px 8px;
        border: 1px solid #dadce0;
        border-radius: 10px;
        background: #fff;
        color: #3c4043;
        font: inherit;
        cursor: pointer;
      }
      .languages button:hover {
        background: #f1f3f4;
      }
      .languages button[aria-pressed="true"] {
        border-color: #1a73e8;
        background: #e8f0fe;
        color: #1967d2;
      }
    </style>
    <div class="popup">
      <div class="languages" dir="auto"></div>
      <div class="content" dir="auto"></div>
    </div>`;
  let languages = shadow.querySelector(".languages");
  let content = shadow.querySelector(".content");
  content.textContent = text;

  let anchor = getSelectionAnchor();
  let frame = 0;
  let place = function() {
    frame = 0;
    let rect = anchor && anchor();
    // The selected nodes may be gone, e.g. replaced with the translation: keep the last position
    if (rect && (rect.width || rect.height)) {
      host.style.top = `${rect.bottom + 6}px`;
      host.style.left = `${rect.left}px`;
    }
  };
  let schedulePlace = function() {
    if (!frame) {
      frame = requestAnimationFrame(place);
    }
  };
  place();
  // Capture catches scrolling of any element, scroll events don't bubble
  document.addEventListener("scroll", schedulePlace, { capture: true, passive: true });
  window.addEventListener("resize", schedulePlace, { passive: true });

  document.documentElement.appendChild(host);
  translationPopupHost = host;
  translationPopupCleanup = function() {
    cancelAnimationFrame(frame);
    document.removeEventListener("scroll", schedulePlace, { capture: true });
    window.removeEventListener("resize", schedulePlace);
  };

  return {
    setText(value) {
      content.textContent = value;
    },
    // Shows the message with a button, resolves when it's clicked
    confirm(message, buttonLabel) {
      return new Promise(function(resolve) {
        let button = document.createElement("button");
        button.type = "button";
        button.className = "action";
        button.textContent = buttonLabel;
        button.addEventListener("click", function() {
          content.textContent = chrome.i18n.getMessage("translating");
          resolve();
        });
        content.textContent = message;
        content.appendChild(button);
      });
    },
    // Language choices for "auto" (Google Translate codes) with the selected one; onPick translates again
    setLanguages(codes, selected, onPick) {
      let label = document.createElement("span");
      label.textContent = chrome.i18n.getMessage("sourceLanguageLabel");
      let buttons = codes.map(function(code) {
        let button = document.createElement("button");
        button.type = "button";
        button.textContent = getLanguageName(code);
        button.setAttribute("aria-pressed", String(code == selected));
        button.addEventListener("click", function() {
          if (button.getAttribute("aria-pressed") == "true") {
            return;
          }
          buttons.forEach(function(other) {
            other.setAttribute("aria-pressed", String(other == button));
          });
          onPick(code);
        });
        return button;
      });
      languages.replaceChildren(label, ...buttons);
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
    translationPopupCleanup();
  }
}

// Returns the current viewport rectangle of the selected text, null when there's nothing to follow
function getSelectionAnchor() {
  let selection = window.getSelection();
  if (selection.rangeCount) {
    let range = selection.getRangeAt(0).cloneRange();
    let rect = range.getBoundingClientRect();
    if (rect.width || rect.height) {
      return function() {
        return range.getBoundingClientRect();
      };
    }
  }
  // Selections inside text fields have no rectangle, follow the field instead
  let element = document.activeElement;
  if (element && (element.tagName == "INPUT" || element.tagName == "TEXTAREA")) {
    return function() {
      return element.getBoundingClientRect();
    };
  }
  return null;
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
