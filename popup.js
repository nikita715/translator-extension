document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("set-yandex-token").addEventListener('click', function(e) {
    let inputElement = document.getElementById("input-yandex-token");
    yandexToken = inputElement.value;
    chrome.storage.local.set({
      yandexToken: yandexToken
    });
    inputElement.value = "";
  });
});
