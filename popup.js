document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.sync.get("translator_translateInputAction", function(item) {
    let value = item["translator_translateInputAction"];
    if (value) {
      let element = document.getElementById("translate-input-type-" + value);
      element.parentNode.classList.add("active");
    } else {
      chrome.storage.sync.set({
        "translator_translateInputAction": "dbclick"
      });
      document.getElementById("translate-input-type-dbclick").parentNode.classList.add("active");
    }
  });
  chrome.storage.sync.get("translator_useNewTab", function(item) {
    let element = document.getElementById("translator-use-open-tab");
    let value = item["translator_useNewTab"];
    if (value) {
      element.checked = value;
      setButtonActivity(element, element.checked);
    } else {
      chrome.storage.sync.set({
        "translator_useNewTab": true
      });
      element.checked = true;
      setButtonActive(element);
    }
  });
  chrome.storage.sync.get("translator_holdAltToTranslate", function(item) {
    let element = document.getElementById("translator-hold-alt-to-translate");
    let value = item["translator_holdAltToTranslate"];
    if (value) {
      element.checked = value;
      setButtonActivity(element, element.checked);
    } else {
      chrome.storage.sync.set({
        "translator_holdAltToTranslate": false
      });
      element.checked = false;
      setButtonNotActive(element);
    }
  });
  chrome.storage.sync.get("translator_source_language", function(item) {
    let element = document.getElementById("translator-source-language");
    let value = item["translator_source_language"];
    if (value) {
      element.value = value;
    } else {
      chrome.storage.sync.set({
        "translator_source_language": "auto"
      });
      element.value = "auto";
    }
  });

  chrome.storage.sync.get("translator_language", function(item) {
    let element = document.getElementById("translator-target-language");
    let value = item["translator_language"];
    if (value) {
      element.value = value;
    } else {
      chrome.storage.sync.set({
        "translator_language": "en"
      });
      element.value = "en";
    }
  });
  document.getElementById("translator-use-open-tab").addEventListener('change', function(e) {
    chrome.storage.sync.set({
      "translator_useNewTab": this.checked
    });
    setButtonActivity(this, this.checked);
  });
  document.getElementById("translator-hold-alt-to-translate").addEventListener('change', function(e) {
    chrome.storage.sync.set({
      "translator_holdAltToTranslate": this.checked
    });
    setButtonActivity(this, this.checked);
  });
  document.getElementById("translator-source-language").addEventListener('change', function(e) {
    chrome.runtime.sendMessage({
      type: "changeLanguage",
      sourceLanguage: this.value
    });
  });
  document.getElementById("translator-target-language").addEventListener('change', function(e) {
    chrome.runtime.sendMessage({
      type: "changeLanguage",
      targetLanguage: this.value
    });
  });

  let sourceLanguageElement = document.getElementById("translator-source-language");
  let targetLanguageElement = document.getElementById("translator-target-language");

  createLanguageOpt(sourceLanguageElement, "Auto", "auto");

  new Map([
    ["Afrikaans", "af"],
    ["Albanian", "sq"],
    ["Arabic", "ar"],
    ["Azerbaijani", "az"],
    ["Basque", "eu"],
    ["Belarusian", "be"],
    ["Bengali", "bn"],
    ["Bulgarian", "bg"],
    ["Catalan", "ca"],
    ["Chinese Simplified", "zh-CN"],
    ["Chinese Traditional", "zh-TW"],
    ["Croatian", "hr"],
    ["Czech", "cs"],
    ["Danish", "da"],
    ["Dutch", "nl"],
    ["English", "en"],
    ["Esperanto", "eo"],
    ["Estonian", "et"],
    ["Filipino", "tl"],
    ["Finnish", "fi"],
    ["French", "fr"],
    ["Galician", "gl"],
    ["Georgian", "ka"],
    ["German", "de"],
    ["Greek", "el"],
    ["Gujarati", "gu"],
    ["Haitian Creole", "ht"],
    ["Hebrew", "iw"],
    ["Hindi", "hi"],
    ["Hungarian", "hu"],
    ["Icelandic", "is"],
    ["Indonesian", "id"],
    ["Irish", "ga"],
    ["Italian", "it"],
    ["Japanese", "ja"],
    ["Kannada", "kn"],
    ["Korean", "ko"],
    ["Latin", "la"],
    ["Latvian", "lv"],
    ["Lithuanian", "lt"],
    ["Macedonian", "mk"],
    ["Malay", "ms"],
    ["Maltese", "mt"],
    ["Norwegian", "no"],
    ["Persian", "fa"],
    ["Polish", "pl"],
    ["Portuguese", "pt"],
    ["Romanian", "ro"],
    ["Russian", "ru"],
    ["Serbian", "sr"],
    ["Slovak", "sk"],
    ["Slovenian", "sl"],
    ["Spanish", "es"],
    ["Swahili", "sw"],
    ["Swedish", "sv"],
    ["Tamil", "ta"],
    ["Telugu", "te"],
    ["Thai", "th"],
    ["Turkish", "tr"],
    ["Ukrainian", "uk"],
    ["Urdu", "ur"],
    ["Vietnamese", "vi"],
    ["Welsh", "cy"],
    ["Yiddish", "yi"]
  ]).forEach(function(value, key, map) {
    createLanguageOpt(sourceLanguageElement, key, value);
    createLanguageOpt(targetLanguageElement, key, value);
  });

  var translateActionTypes = document.getElementsByClassName("translate-input-type");
  for (let i = 0; i < translateActionTypes.length; i++) {
    translateActionTypes[i].addEventListener("click", function(e) {
      for (let j = 0; j < translateActionTypes.length; j++) {
        translateActionTypes[j].parentNode.classList.remove("active");
      }
      this.parentNode.classList.add("active");
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: e.target.value
      });
    });
  }

});

function setButtonActivity(element, bool) {
  if (bool) {
    setButtonActive(element);
  } else {
    setButtonNotActive(element);
  }
}

function setButtonNotActive(element) {
  element.parentNode.classList.remove("btn-success");
  element.parentNode.classList.add("btn-light");
}

function setButtonActive(element) {
  element.parentNode.classList.remove("btn-light");
  element.parentNode.classList.add("btn-success");
}

function createLanguageOpt(parent, key, value) {
  var option = document.createElement("option");
  option.value = value;
  option.innerHTML = key;
  parent.appendChild(option);
}
