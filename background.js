chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    chrome.storage.local.get("yandexToken", function(item) {
      let yandexToken = item["yandexToken"];
      fetch(buildUrl(yandexToken, request.text))
        .then(response => response.text())
        .then(text => sendResponse(text));
    });
    return true;
  }
);

function buildUrl(token, text) {
  return "https://translate.yandex.net/api/v1.5/tr.json/translate" +
    `?key=${token}&text=${text}&lang=ru`;
}
