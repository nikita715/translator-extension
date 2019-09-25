const yandexToken = "";

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    var url = "https://translate.yandex.net/api/v1.5/tr.json/translate?key=" + yandexToken + "&text=" +
      request.text + "&lang=ru";
    fetch(url)
      .then(response => response.text())
      .then(text => sendResponse(text));
    return true;
  }
);
