chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    let text = request.text;
    if (request.type == "findTab") {
      let tab = findAndUpdateTranslateTab(text);
      if (tab) {
        sendResponse(tab);
        return true;
      }
    } else if (request.type == "createTab") {
      let tab = createTranslateTab(text);
      if (tab) {
        sendResponse(tab);
        return true;
      }
    }
    return true;
  }
);

function findAndUpdateTranslateTab(text) {
  let newUrl = buildUrl(text);
  chrome.tabs.query({
    currentWindow: true,
    url: 'https://translate.google.ru/*'
  }, function(tabs) {
    if (tabs[0]) {
      let translateTab = tabs[0];
      chrome.tabs.update(translateTab.id, {
        'url': newUrl,
        'active': true
      });
      return translateTab;
    }
  });
}

function createTranslateTab(text) {
  let newUrl = buildUrl(text);
  chrome.tabs.create({
    'url': newUrl
  }, function(tab) {
    return tab;
  });
}

function buildUrl(text) {
  return `https://translate.google.ru/#view=home&op=translate&sl=en&tl=ru&text=${text}`;
}

chrome.contextMenus.create({
  id: "translate-selection",
  title: "Translate",
  contexts: ["selection"]
});


chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == "translate-selection") {
    let text = info.selectionText;
    findAndUpdateTranslateTab(text);
  }
});
