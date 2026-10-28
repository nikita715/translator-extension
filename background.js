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

// Bergamot settings: the models origin the extension asks access to
importScripts("engines/languages.js");

let translateMenuItemId = "translate-selection";

// The service worker restarts often while menu items persist, so recreate the item instead of adding a duplicate.
// Recreating also keeps the title in the current browser language.
chrome.contextMenus.removeAll(function() {
  chrome.contextMenus.create({
    id: translateMenuItemId,
    title: chrome.i18n.getMessage("contextMenuTranslate"),
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == translateMenuItemId) {
    translate(info.selectionText, null, false, true, tab ? tab.id : null);
  }
});

let defaultPropertyValues = {
  "translator_holdAltToTranslate": false,
  "translator_translateInputAction": "dbclick",
  "translator_sourceLanguage": "auto",
  "translator_targetLanguage": "en",
  "translator_useOpenTab": true,
  "translator_useBuiltIn": true,
  "translator_replaceText": false,
  "translator_googleFallback": false,
  "translator_askBeforeDownload": true,
  "translator_engine": "chrome"
}

chrome.storage.sync.get(Object.keys(defaultPropertyValues), function(items) {
  let map = {};
  Object.keys(defaultPropertyValues).forEach(function(key) {
    if (items[key] == undefined) {
      map[key] = defaultPropertyValues[key];
    }
  });
  chrome.storage.sync.set(map);
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.type == "translate") {
      sendResponse(translate(request.text, request.action, request.altActive, false, sender.tab ? sender.tab.id : null));
      return true;
    } else if (request.type == "changeAction") {
      chrome.storage.sync.set({
        "translator_translateInputAction": request.value
      });
      chrome.action.setBadgeText({
        text: request.value.charAt(0).toUpperCase()
      });
    } else if (request.type == "translateWithEngine") {
      forwardToOffscreen(request, sender.tab ? sender.tab.id : null).then(sendResponse);
      return true;
    } else if (request.type == "checkEngineLanguages" || request.type == "checkEngineDownload") {
      forwardToOffscreen(request, sender.tab ? sender.tab.id : null).then(sendResponse);
      return true;
    } else if (request.type == "engineProgress") {
      if (request.tabId != null) {
        chrome.tabs.sendMessage(request.tabId, request).catch(function() {});
      }
    } else if (request.type == "getEngineOrder") {
      getEngineOrder(request.engine).then(function(order) {
        sendResponse({ engines: order });
      });
      return true;
    } else if (request.type == "offscreenIdle") {
      chrome.offscreen.closeDocument().catch(function() {});
    } else if (request.type == "changeLanguage") {
      let languages = {};
      if (request.sourceLanguage) {
        languages["translator_sourceLanguage"] = request.sourceLanguage;
      }
      if (request.targetLanguage) {
        languages["translator_targetLanguage"] = request.targetLanguage;
      }
      chrome.storage.sync.set(languages);
      changeLanguageOnPage(request.sourceLanguage, request.targetLanguage);
    }
  }
);

async function hasEngineAccess(engine) {
  return engine != "bergamot" || chrome.permissions.contains({ origins: [bergamotModelsOrigin] });
}

// The default engine goes first; the others follow when they can be used, Bergamot only with access to the models
async function getEngineOrder(defaultEngine) {
  let others = engines.filter(function(engine) {
    return engine != defaultEngine;
  });
  let access = await Promise.all(others.map(hasEngineAccess));
  return [defaultEngine].concat(others.filter(function(engine, i) {
    return access[i];
  }));
}

// Bergamot runs in an offscreen document: the service worker can't start workers
let offscreenDocumentPromise = null;

async function ensureOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  if (!offscreenDocumentPromise) {
    offscreenDocumentPromise = chrome.offscreen.createDocument({
      url: "engines/offscreen.html",
      reasons: ["WORKERS"],
      justification: "Runs offline translation models"
    }).finally(function() {
      offscreenDocumentPromise = null;
    });
  }
  await offscreenDocumentPromise;
}

async function forwardToOffscreen(request, tabId) {
  try {
    await ensureOffscreenDocument();
    return await chrome.runtime.sendMessage({ ...request, target: "offscreen", tabId });
  } catch (error) {
    return { error: { name: "Error", message: String(error) } };
  }
}

// A saved engine this version doesn't have falls back to Chrome
let engines = ["chrome", "bergamot"];

let slRegexp = new RegExp("^.+sl=([a-z]+).*$");
let tlRegexp = new RegExp("^.+tl=([a-z]+).*$");
let textRegexp = new RegExp("^.+text=(.+)$");

function changeLanguageOnPage(source, target) {
  chrome.tabs.query({
    currentWindow: true,
    active: true,
    url: 'https://translate.google.com/*'
  }, function(tabs) {
    let translateTab = tabs[0];
    if (translateTab) {
      let currentUrl = translateTab.url;
      let sourceLanguage = source ? source : currentUrl.match(slRegexp)[1];
      let targetLanguage = target ? target : currentUrl.match(tlRegexp)[1];
      let text = decodeURIComponent(currentUrl.match(textRegexp)[1]);
      let newUrl = buildUrl(text, sourceLanguage, targetLanguage);
      updateTranslatorTab(translateTab.id, newUrl);
    }
  });
}

chrome.storage.sync.get("translator_translateInputAction", function(item) {
  let translateInputAction = item["translator_translateInputAction"];
  let text = translateInputAction ? translateInputAction.charAt(0).toUpperCase() : "D";
  chrome.action.setBadgeText({
    text
  });
});

function translate(text, action, altActive, force, tabId) {
  chrome.storage.sync.get([
    "translator_holdAltToTranslate",
    "translator_translateInputAction",
    "translator_sourceLanguage",
    "translator_targetLanguage",
    "translator_useOpenTab",
    "translator_useBuiltIn",
    "translator_replaceText",
    "translator_googleFallback",
    "translator_askBeforeDownload",
    "translator_engine"
  ], function(item) {
    let holdAltToTranslate = item["translator_holdAltToTranslate"];
    if (!holdAltToTranslate || altActive || force) {
      let translateInputAction = item["translator_translateInputAction"];
      if (translateInputAction == action || force) {
        let sourceLanguage = item["translator_sourceLanguage"];
        let targetLanguage = item["translator_targetLanguage"];
        let useOpenTab = item["translator_useOpenTab"];
        let googleFallback = item["translator_googleFallback"] == true;
        if (item["translator_useBuiltIn"]) {
          if (tabId == null) {
            if (googleFallback) {
              openTranslatorTab(text, sourceLanguage, targetLanguage, useOpenTab);
            }
            return;
          }
          // Chrome Translator API is not exposed to service workers, so translate in the page
          chrome.tabs.sendMessage(tabId, {
            type: "translateBuiltIn",
            text,
            sourceLanguage,
            targetLanguage,
            replaceText: item["translator_replaceText"],
            engine: engines.includes(item["translator_engine"]) ? item["translator_engine"] : "chrome",
            askBeforeDownload: item["translator_askBeforeDownload"] != false,
            googleFallback
          }, function(response) {
            let failed = chrome.runtime.lastError || !response || !response.success;
            if (failed && googleFallback) {
              openTranslatorTab(text, sourceLanguage, targetLanguage, useOpenTab);
            }
          });
        } else {
          openTranslatorTab(text, sourceLanguage, targetLanguage, useOpenTab);
        }
      }
    }
  });
}

function openTranslatorTab(text, sourceLanguage, targetLanguage, useOpenTab) {
  let newUrl = buildUrl(text, sourceLanguage, targetLanguage);
  if (useOpenTab) {
    chrome.tabs.query({
      currentWindow: true,
      url: 'https://translate.google.com/*'
    }, function(tabs) {
      let translateTab = tabs[0];
      if (translateTab) {
        updateTranslatorTab(translateTab.id, newUrl);
      } else {
        createTranslatorTab(newUrl);
      }
    });
  } else {
    createTranslatorTab(newUrl);
  }
}

function createTranslatorTab(url) {
  chrome.tabs.create({
    'url': url
  });
}

function updateTranslatorTab(id, newUrl) {
  chrome.tabs.update(id, {
    'url': newUrl,
    'active': true
  });
}

function buildUrl(text, sourceLanguage, targetLanguage) {
  let sourceLanguageProperty = sourceLanguage ? `&sl=${sourceLanguage}` : "";
  let targetLanguageProperty = targetLanguage ? `&tl=${targetLanguage}` : "";
  let textProperty = text ? `&text=${text}` : "";
  return `https://translate.google.com/#view=home&op=translate${sourceLanguageProperty}${targetLanguageProperty}${textProperty}`;
}
