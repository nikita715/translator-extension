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

function sendToTranslate(e, action, text) {
  if (!isBlank(text) && notInputTag(e.target)) {
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
  if (e.altKey) {
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
      replaceWithTranslation(segments, request.sourceLanguage, request.targetLanguage).then(function() {
        sendResponse({ success: true });
      }).catch(function(error) {
        console.debug("Translator: built-in translation failed, falling back to Google Translate", error);
        sendResponse({ success: false });
      });
      return true;
    }
    let popup = showTranslationPopup("Translating…");
    translateBuiltIn([request.text], request.sourceLanguage, request.targetLanguage, function(progress) {
      popup.setText(`Downloading language model… ${Math.round(progress * 100)}%`);
    }).then(function([translation]) {
      popup.setText(translation);
      sendResponse({ success: true });
    }).catch(function(error) {
      console.debug("Translator: built-in translation failed, falling back to Google Translate", error);
      popup.close();
      sendResponse({ success: false });
    });
    return true;
  }
});

// Google Translate codes that differ from the BCP 47 tags used by Chrome Translator API
let builtInLanguageCodes = {
  "iw": "he",
  "jw": "jv",
  "zh-CN": "zh",
  "zh-TW": "zh-Hant"
};

let translators = new Map();

async function translateBuiltIn(texts, sourceLanguage, targetLanguage, onDownloadProgress) {
  if (!("Translator" in self)) {
    throw new Error("Translator API is not supported");
  }
  targetLanguage = toBuiltInLanguageCode(targetLanguage);
  sourceLanguage = sourceLanguage == "auto" ?
    await detectLanguage(texts.join(" ")) :
    toBuiltInLanguageCode(sourceLanguage);
  if (sourceLanguage == targetLanguage) {
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

async function replaceWithTranslation(segments, sourceLanguage, targetLanguage) {
  let popup = null;
  try {
    let translations = await translateBuiltIn(segments.map(function(node) {
      return node.data.trim();
    }), sourceLanguage, targetLanguage, function(progress) {
      popup = popup || showTranslationPopup("");
      popup.setText(`Downloading language model… ${Math.round(progress * 100)}%`);
    });
    segments.forEach(function(node, i) {
      // Keep surrounding whitespace so words don't stick to neighbouring nodes
      let leading = node.data.match(/^\s*/)[0];
      let trailing = node.data.match(/\s*$/)[0];
      node.data = leading + translations[i] + trailing;
    });
    window.getSelection().removeAllRanges();
  } finally {
    if (popup) {
      popup.close();
    }
  }
}

async function createTranslator(sourceLanguage, targetLanguage, onDownloadProgress) {
  let availability = await Translator.availability({ sourceLanguage, targetLanguage });
  if (availability == "unavailable") {
    throw new Error(`Language pair ${sourceLanguage} -> ${targetLanguage} is unavailable`);
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
    throw new Error("Language Detector API is not supported");
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
    throw new Error("Unable to detect language");
  }
  return language;
}

function toBuiltInLanguageCode(code) {
  return builtInLanguageCodes[code] || code;
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
    <div class="popup"></div>`;
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
