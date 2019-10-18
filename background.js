chrome.contextMenus.create({
  id: "translate-selection",
  title: "Translate",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == "translate-selection") {
    translate(info.selectionText, null, true);
  }
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.type == "translate") {
      sendResponse(translate(request.text, request.action, false));
      return true;
    } else if (request.type == "changeAction") {
      chrome.storage.sync.set({
        "translator_translateInputAction": request.value
      });
      chrome.browserAction.setBadgeText({
        text: request.value.charAt(0).toUpperCase()
      });
    }
  }
);

chrome.storage.sync.get("translator_translateInputAction", function(item) {
  let translateInputAction = item["translator_translateInputAction"];
  chrome.browserAction.setBadgeText({
    text: translateInputAction.charAt(0).toUpperCase()
  });
});

function translate(text, action, force) {
  chrome.storage.sync.get("translator_translateInputAction", function(item) {
    let translateInputAction = item["translator_translateInputAction"];
    if (translateInputAction == action || force) {
      chrome.storage.sync.get("translator_source_language", function(item) {
        let sourceLanguageTag = item["translator_source_language"];
        chrome.storage.sync.get("translator_language", function(item) {
          let languageTag = item["translator_language"];
          let newUrl = buildUrl(text, sourceLanguageTag, languageTag);
          chrome.storage.sync.get("translator_useNewTab", function(item) {
            let useNewTab = item["translator_useNewTab"];
            if (useNewTab) {
              chrome.tabs.query({
                currentWindow: true,
                url: 'https://translate.google.ru/*'
              }, async function(tabs) {
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

function createTranslatorTab(url) {
  chrome.tabs.create({
    'url': url
  }, function(translateTab) {
    return translateTab;
  });
}

function buildUrl(text, sourceLanguage, targetLanguage) {
  return `https://translate.google.ru/#view=home&op=translate&sl=${sourceLanguage}&tl=${targetLanguage}&text=${text}`;
}
