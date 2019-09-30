chrome.contextMenus.create({
  id: "translate-selection",
  title: "Translate",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId == "translate-selection") {
    translate(info.selectionText);
  }
});

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.type == "translate") {
      sendResponse(translate(request.text));
      return true;
    }
  }
);

function translate(text) {
  let newUrl = buildUrl(text);
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
      return await translateTab;
    } else {
      chrome.tabs.create({
        'url': newUrl
      }, async function (translateTab) {
        return await translateTab;
      });
    }
  });
}

function buildUrl(text) {
  return `https://translate.google.ru/#view=home&op=translate&sl=en&tl=ru&text=${text}`;
}
