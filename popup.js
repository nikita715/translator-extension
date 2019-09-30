document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.local.get("translator_useNewTab", function (item) {
    document.getElementById("translator-use-open-tab").checked = item["translator_useNewTab"];
  });
  chrome.storage.local.get("translator_language", function (item) {
    document.getElementById("translator-select-language").value = item["translator_language"];
  });
  document.getElementById("translator-use-open-tab").addEventListener('change', function (e) {
    chrome.storage.local.set({
      "translator_useNewTab": this.checked
    });
  });
  document.getElementById("translator-select-language").addEventListener('change', function (e) {
    chrome.storage.local.set({
      "translator_language": this.value
    });
  });
});
