let contextMenus = []

contextMenus.forEach(function (element) {
  chrome.contextMenus.remove(element);
});

let contextMenusId = "translate-selection";
contextMenus[contextMenusId] = chrome.contextMenus.create({
  id: contextMenusId,
  title: "Translate",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId == "translate-selection") {
    translate(info.selectionText, null, false, true);
  }
});

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
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
          "translator_source_language": request.sourceLanguage
        });
        changeLanguageOnPage(request.sourceLanguage, null);
      } else if (request.targetLanguage) {
        chrome.storage.sync.set({
          "translator_language": request.targetLanguage
        });
        changeLanguageOnPage(null, request.targetLanguage);
      }
    }
  }
);

function changeLanguageOnPage(source, target) {
  let slRegexp = new RegExp("^.+sl=([a-z]+).*$");
  let tlRegexp = new RegExp("^.+tl=([a-z]+).*$");
  let textRegexp = new RegExp("^.+text=(.+)$");
  chrome.tabs.query({
    currentWindow: true,
    active: true,
    url: 'https://translate.google.ru/*'
  }, function (tabs) {
    let translateTab = tabs[0];
    if (translateTab) {
      let currentUrl = translateTab.url;
      let sourceLanguage = source ? source : currentUrl.match(slRegexp)[1];
      let targetLanguage = target ? target : currentUrl.match(tlRegexp)[1];
      let text = decodeURIComponent(currentUrl.match(textRegexp)[1]);
      let newUrl = buildUrl(text, sourceLanguage, targetLanguage);
      chrome.tabs.update(translateTab.id, {
        'url': newUrl
      });
    }
  });
}

chrome.storage.sync.get("translator_translateInputAction", function (item) {
  let translateInputAction = item["translator_translateInputAction"];
  let currentActionType = translateInputAction ? translateInputAction : "d";
  chrome.browserAction.setBadgeText({
    text: currentActionType.charAt(0).toUpperCase()
  });
});

function translate(text, action, altActive, force) {
  chrome.storage.sync.get("translator_holdAltToTranslate", function (item) {
    let holdAltToTranslate = item["translator_holdAltToTranslate"];
    if (!holdAltToTranslate || altActive || force) {
      chrome.storage.sync.get("translator_translateInputAction", function (item) {
        let translateInputAction = item["translator_translateInputAction"];
        if (translateInputAction == action || force) {
          chrome.storage.sync.get("translator_source_language", function (item) {
            let sourceLanguageTag = item["translator_source_language"];
            chrome.storage.sync.get("translator_language", function (item) {
              let languageTag = item["translator_language"];
              let newUrl = buildUrl(text, sourceLanguageTag, languageTag);
              chrome.storage.sync.get("translator_useNewTab", function (item) {
                let useNewTab = item["translator_useNewTab"];
                if (useNewTab) {
                  chrome.tabs.query({
                    currentWindow: true,
                    url: 'https://translate.google.ru/*'
                  }, function (tabs) {
                    let translateTab = tabs[0];
                    if (translateTab) {
                      chrome.tabs.update(translateTab.id, {
                        'url': newUrl,
                        'active': true
                      });
                    } else {
                      createTranslatorTab(newUrl);
                    }
                  });
                } else {
                  createTranslatorTab(newUrl);
                }
              });
            });
          });
        }
      });
    }
  });
}

function createTranslatorTab(url) {
  chrome.tabs.create({
    'url': url
  }, function (translateTab) {
    return translateTab;
  });
}

function buildUrl(text, sourceLanguage, targetLanguage) {
  let sourceLanguageProperty = sourceLanguage ? `&sl=${sourceLanguage}` : "";
  let targetLanguageProperty = targetLanguage ? `&tl=${targetLanguage}` : "";
  let textProperty = text ? `&text=${text}` : "";
  return `https://translate.google.ru/#view=home&op=translate${sourceLanguageProperty}${targetLanguageProperty}${textProperty}`;
}
