let translateMenuItemId = "translate-selection";

chrome.contextMenus.create({
  id: translateMenuItemId,
  title: "Translate",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == translateMenuItemId) {
    translate(info.selectionText, null, false, true);
  }
});

let defaultPropertyValues = {
  "translator_holdAltToTranslate": false,
  "translator_translateInputAction": "dbclick",
  "translator_sourceLanguage": "auto",
  "translator_targetLanguage": "en",
  "translator_useOpenTab": true
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
      sendResponse(translate(request.text, request.action, request.altActive, false));
      return true;
    } else if (request.type == "changeAction") {
      chrome.storage.sync.set({
        "translator_translateInputAction": request.value
      });
      chrome.browserAction.setBadgeText({
        text: request.value.charAt(0).toUpperCase()
      });
    } else if (request.type == "changeLanguage") {
      if (request.sourceLanguage) {
        chrome.storage.sync.set({
          "translator_sourceLanguage": request.sourceLanguage
        });
        changeLanguageOnPage(request.sourceLanguage, null);
      } else if (request.targetLanguage) {
        chrome.storage.sync.set({
          "translator_targetLanguage": request.targetLanguage
        });
        changeLanguageOnPage(null, request.targetLanguage);
      }
    }
  }
);

let slRegexp = new RegExp("^.+sl=([a-z]+).*$");
let tlRegexp = new RegExp("^.+tl=([a-z]+).*$");
let textRegexp = new RegExp("^.+text=(.+)$");

function changeLanguageOnPage(source, target) {
  chrome.tabs.query({
    currentWindow: true,
    active: true,
    url: 'https://translate.google.ru/*'
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
  chrome.browserAction.setBadgeText({
    text
  });
});

function translate(text, action, altActive, force) {
  chrome.storage.sync.get([
    "translator_holdAltToTranslate",
    "translator_translateInputAction",
    "translator_sourceLanguage",
    "translator_targetLanguage",
    "translator_useOpenTab"
  ], function(item) {
    let holdAltToTranslate = item["translator_holdAltToTranslate"];
    if (!holdAltToTranslate || altActive || force) {
      let translateInputAction = item["translator_translateInputAction"];
      if (translateInputAction == action || force) {
        let newUrl = buildUrl(text,
          item["translator_sourceLanguage"],
          item["translator_targetLanguage"]);
        let useOpenTab = item["translator_useOpenTab"];
        if (useOpenTab) {
          chrome.tabs.query({
            currentWindow: true,
            url: 'https://translate.google.ru/*'
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
    }
  });
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
  return `https://translate.google.ru/#view=home&op=translate${sourceLanguageProperty}${targetLanguageProperty}${textProperty}`;
}
