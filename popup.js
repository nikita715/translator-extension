document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.sync.get("translator_doubleClickEnabled", function (item) {
    let element = document.getElementById("translator-double-click-enabled");
    let value = item["translator_doubleClickEnabled"];
    if (value != undefined) {
      element.checked = value;
    } else {
      chrome.storage.sync.set({
        "translator_doubleClickEnabled": true
      });
      element.checked = true;
    }
  });
  chrome.storage.sync.get("translator_useNewTab", function (item) {
    let element = document.getElementById("translator-use-open-tab");
    let value = item["translator_useNewTab"];
    if (value != undefined) {
      element.checked = value;
    } else {
      chrome.storage.sync.set({
        "translator_useNewTab": true
      });
      element.checked = true;
    }
  });
  chrome.storage.sync.get("translator_language", function (item) {
    let element = document.getElementById("translator-select-language");
    let value = item["translator_language"];
    if (value) {
      element.value = value;
    } else {
      chrome.storage.sync.set({
        "translator_language": "English"
      });
      element.value = "English";
    }
  });

  document.getElementById("translator-use-open-tab").addEventListener('change', function (e) {
    chrome.storage.sync.set({
      "translator_useNewTab": this.checked
    });
  });
  document.getElementById("translator-double-click-enabled").addEventListener('change', function (e) {
    chrome.storage.sync.set({
      "translator_doubleClickEnabled": this.checked
    });
  });
  document.getElementById("translator-select-language").addEventListener('change', function (e) {
    chrome.storage.sync.set({
      "translator_language": this.value
    });
  });
});
