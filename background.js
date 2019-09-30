chrome.contextMenus.create({
  id: "translate-selection",
  title: "Translate",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId == "translate-selection") {
    translate(info.selectionText, true);
  }
});

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.type == "translate") {
      sendResponse(translate(request.text, false));
      return true;
    }
  }
);

function translate(text, force) {
  chrome.storage.sync.get("translator_doubleClickEnabled", function (item) {
    let doubleClickEnabled = item["translator_doubleClickEnabled"];
    if (doubleClickEnabled || force) {
      chrome.storage.sync.get("translator_language", function (item) {
        let languageTag = getLanguageTag(item["translator_language"]);
        let newUrl = buildUrl(text, languageTag);
        chrome.storage.sync.get("translator_useNewTab", function (item) {
          let useNewTab = item["translator_useNewTab"];
          if (useNewTab) {
            chrome.tabs.query({
              currentWindow: true,
              url: 'https://translate.google.ru/*'
            }, async function (tabs) {
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

function getLanguageTag(language) {
  switch (language) {
    case "Russian":
      return "ru";
    case "English":
      return "en";
    default:
      return "en";
  }
}

function buildUrl(text, language) {
  return `https://translate.google.ru/#view=home&op=translate&sl=auto&tl=${language}&text=${text}`;
}
