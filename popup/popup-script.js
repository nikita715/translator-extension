/*
   Copyright 2019 Nikita Stepochkin

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

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
  chrome.storage.sync.get("translator_useOpenTab", function(item) {
    let element = document.getElementById("translator-use-open-tab");
    let value = item["translator_useOpenTab"];
    console.log(value);
    if (value != undefined) {
      element.checked = value;
      setButtonActivity(element, value);
    } else {
      chrome.storage.sync.set({
        "translator_useOpenTab": true
      });
      element.checked = true;
      setButtonActive(element);
    }
  });
  chrome.storage.sync.get("translator_holdAltToTranslate", function(item) {
    let element = document.getElementById("translator-hold-alt-to-translate");
    let value = item["translator_holdAltToTranslate"];
    if (value != undefined) {
      element.checked = value;
      setButtonActivity(element, value);
    } else {
      chrome.storage.sync.set({
        "translator_holdAltToTranslate": false
      });
      element.checked = false;
      setButtonNotActive(element);
    }
  });
  chrome.storage.sync.get("translator_sourceLanguage", function(item) {
    let element = document.getElementById("translator-source-language");
    let value = item["translator_sourceLanguage"];
    if (value) {
      element.value = value;
    } else {
      chrome.storage.sync.set({
        "translator_sourceLanguage": "auto"
      });
      element.value = "auto";
    }
  });

  chrome.storage.sync.get("translator_targetLanguage", function(item) {
    let element = document.getElementById("translator-target-language");
    let value = item["translator_targetLanguage"];
    if (value) {
      element.value = value;
    } else {
      chrome.storage.sync.set({
        "translator_targetLanguage": "en"
      });
      element.value = "en";
    }
  });
  document.getElementById("translator-use-open-tab").addEventListener('change', function(e) {
    chrome.storage.sync.set({
      "translator_useOpenTab": this.checked
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
