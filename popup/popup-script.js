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
    ["Abkhaz", "ab"],
    ["Acehnese", "ace"],
    ["Acholi", "ach"],
    ["Afar", "aa"],
    ["Afrikaans", "af"],
    ["Albanian", "sq"],
    ["Alur", "alz"],
    ["Amharic", "am"],
    ["Arabic", "ar"],
    ["Armenian", "hy"],
    ["Assamese", "as"],
    ["Avar", "av"],
    ["Awadhi", "awa"],
    ["Aymara", "ay"],
    ["Azerbaijani", "az"],
    ["Balinese", "ban"],
    ["Baluchi", "bal"],
    ["Bambara", "bm"],
    ["Baoul&#x00E9;", "bci"],
    ["Bashkir", "ba"],
    ["Basque", "eu"],
    ["Batak Karo", "btx"],
    ["Batak Simalungun", "bts"],
    ["Batak Toba", "bbc"],
    ["Belarusian", "be"],
    ["Bemba", "bem"],
    ["Bengali", "bn"],
    ["Betawi", "bew"],
    ["Bhojpuri", "bho"],
    ["Bikol", "bik"],
    ["Bosnian", "bs"],
    ["Breton", "br"],
    ["Bulgarian", "bg"],
    ["Buryat", "bua"],
    ["Cantonese", "yue"],
    ["Catalan", "ca"],
    ["Cebuano", "ceb"],
    ["Chamorro", "ch"],
    ["Chechen", "ce"],
    ["Chichewa", "ny"],
    ["Chinese (Simplified)", "zh-CN"],
    ["Chinese (Traditional)", "zh-TW"],
    ["Chuukese", "chk"],
    ["Chuvash", "cv"],
    ["Corsican", "co"],
    ["Crimean Tatar (Cyrillic)", "crh"],
    ["Crimean Tatar (Latin)", "crh-Latn"],
    ["Croatian", "hr"],
    ["Czech", "cs"],
    ["Danish", "da"],
    ["Dari", "fa-AF"],
    ["Dhivehi", "dv"],
    ["Dinka", "din"],
    ["Dogri", "doi"],
    ["Dombe", "dov"],
    ["Dutch", "nl"],
    ["Dyula", "dyu"],
    ["Dzongkha", "dz"],
    ["English", "en"],
    ["Esperanto", "eo"],
    ["Estonian", "et"],
    ["Ewe", "ee"],
    ["Faroese", "fo"],
    ["Fijian", "fj"],
    ["Filipino", "tl"],
    ["Finnish", "fi"],
    ["Fon", "fon"],
    ["French", "fr"],
    ["French (Canada)", "fr-CA"],
    ["Frisian", "fy"],
    ["Friulian", "fur"],
    ["Fulani", "ff"],
    ["Ga", "gaa"],
    ["Galician", "gl"],
    ["Georgian", "ka"],
    ["German", "de"],
    ["Greek", "el"],
    ["Guarani", "gn"],
    ["Gujarati", "gu"],
    ["Haitian Creole", "ht"],
    ["Hakha Chin", "cnh"],
    ["Hausa", "ha"],
    ["Hawaiian", "haw"],
    ["Hebrew", "iw"],
    ["Hiligaynon", "hil"],
    ["Hindi", "hi"],
    ["Hmong", "hmn"],
    ["Hungarian", "hu"],
    ["Hunsrik", "hrx"],
    ["Iban", "iba"],
    ["Icelandic", "is"],
    ["Igbo", "ig"],
    ["Ilocano", "ilo"],
    ["Indonesian", "id"],
    ["Inuktut (Latin)", "iu-Latn"],
    ["Inuktut (Syllabics)", "iu"],
    ["Irish", "ga"],
    ["Italian", "it"],
    ["Jamaican Patois", "jam"],
    ["Japanese", "ja"],
    ["Javanese", "jw"],
    ["Jingpo", "kac"],
    ["Kalaallisut", "kl"],
    ["Kannada", "kn"],
    ["Kanuri", "kr"],
    ["Kapampangan", "pam"],
    ["Kazakh", "kk"],
    ["Khasi", "kha"],
    ["Khmer", "km"],
    ["Kiga", "cgg"],
    ["Kikongo", "kg"],
    ["Kinyarwanda", "rw"],
    ["Kituba", "ktu"],
    ["Kokborok", "trp"],
    ["Komi", "kv"],
    ["Konkani", "gom"],
    ["Korean", "ko"],
    ["Krio", "kri"],
    ["Kurdish (Kurmanji)", "ku"],
    ["Kurdish (Sorani)", "ckb"],
    ["Kyrgyz", "ky"],
    ["Lao", "lo"],
    ["Latgalian", "ltg"],
    ["Latin", "la"],
    ["Latvian", "lv"],
    ["Ligurian", "lij"],
    ["Limburgish", "li"],
    ["Lingala", "ln"],
    ["Lithuanian", "lt"],
    ["Lombard", "lmo"],
    ["Luganda", "lg"],
    ["Luo", "luo"],
    ["Luxembourgish", "lb"],
    ["Macedonian", "mk"],
    ["Madurese", "mad"],
    ["Maithili", "mai"],
    ["Makassar", "mak"],
    ["Malagasy", "mg"],
    ["Malay", "ms"],
    ["Malay (Jawi)", "ms-Arab"],
    ["Malayalam", "ml"],
    ["Maltese", "mt"],
    ["Mam", "mam"],
    ["Manx", "gv"],
    ["Maori", "mi"],
    ["Marathi", "mr"],
    ["Marshallese", "mh"],
    ["Marwadi", "mwr"],
    ["Mauritian Creole", "mfe"],
    ["Meadow Mari", "chm"],
    ["Meiteilon (Manipuri)", "mni-Mtei"],
    ["Minang", "min"],
    ["Mizo", "lus"],
    ["Mongolian", "mn"],
    ["Myanmar (Burmese)", "my"],
    ["Nahuatl (Eastern Huasteca)", "nhe"],
    ["Ndau", "ndc-ZW"],
    ["Ndebele (South)", "nr"],
    ["Nepalbhasa (Newari)", "new"],
    ["Nepali", "ne"],
    ["NKo", "bm-Nkoo"],
    ["Norwegian", "no"],
    ["Nuer", "nus"],
    ["Occitan", "oc"],
    ["Odia (Oriya)", "or"],
    ["Oromo", "om"],
    ["Ossetian", "os"],
    ["Pangasinan", "pag"],
    ["Papiamento", "pap"],
    ["Pashto", "ps"],
    ["Persian", "fa"],
    ["Polish", "pl"],
    ["Portuguese (Brazil)", "pt"],
    ["Portuguese (Portugal)", "pt-PT"],
    ["Punjabi (Gurmukhi)", "pa"],
    ["Punjabi (Shahmukhi)", "pa-Arab"],
    ["Quechua", "qu"],
    ["Q&#x02BC;eqchi&#x02BC;", "kek"],
    ["Romani", "rom"],
    ["Romanian", "ro"],
    ["Rundi", "rn"],
    ["Russian", "ru"],
    ["Sami (North)", "se"],
    ["Samoan", "sm"],
    ["Sango", "sg"],
    ["Sanskrit", "sa"],
    ["Santali (Latin)", "sat-Latn"],
    ["Santali (Ol Chiki)", "sat"],
    ["Scots Gaelic", "gd"],
    ["Sepedi", "nso"],
    ["Serbian", "sr"],
    ["Sesotho", "st"],
    ["Seychellois Creole", "crs"],
    ["Shan", "shn"],
    ["Shona", "sn"],
    ["Sicilian", "scn"],
    ["Silesian", "szl"],
    ["Sindhi", "sd"],
    ["Sinhala", "si"],
    ["Slovak", "sk"],
    ["Slovenian", "sl"],
    ["Somali", "so"],
    ["Spanish", "es"],
    ["Sundanese", "su"],
    ["Susu", "sus"],
    ["Swahili", "sw"],
    ["Swati", "ss"],
    ["Swedish", "sv"],
    ["Tahitian", "ty"],
    ["Tajik", "tg"],
    ["Tamazight", "ber-Latn"],
    ["Tamazight (Tifinagh)", "ber"],
    ["Tamil", "ta"],
    ["Tatar", "tt"],
    ["Telugu", "te"],
    ["Tetum", "tet"],
    ["Thai", "th"],
    ["Tibetan", "bo"],
    ["Tigrinya", "ti"],
    ["Tiv", "tiv"],
    ["Tok Pisin", "tpi"],
    ["Tongan", "to"],
    ["Tshiluba", "lua"],
    ["Tsonga", "ts"],
    ["Tswana", "tn"],
    ["Tulu", "tcy"],
    ["Tumbuka", "tum"],
    ["Turkish", "tr"],
    ["Turkmen", "tk"],
    ["Tuvan", "tyv"],
    ["Twi", "ak"],
    ["Udmurt", "udm"],
    ["Ukrainian", "uk"],
    ["Urdu", "ur"],
    ["Uyghur", "ug"],
    ["Uzbek", "uz"],
    ["Vietnamese", "vi"],
    ["Waray", "war"],
    ["Welsh", "cy"],
    ["Wolof", "wo"],
    ["Xhosa", "xh"],
    ["Yakut", "sah"],
    ["Yiddish", "yi"],
    ["Yoruba", "yo"],
    ["Yucatec Maya", "yua"],
    ["Zapotec", "zap"],
    ["Zulu", "zu"],
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
