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
  let sourceLanguageElement = document.getElementById("translator-source-language");
  let targetLanguageElement = document.getElementById("translator-target-language");
  let swapLanguagesElement = document.getElementById("translator-swap-languages");
  let triggerElements = document.querySelectorAll('input[name="trigger"]');
  let displayElements = document.querySelectorAll('input[name="display"]');

  localizePage();
  document.getElementById("translator-hold-alt-label").textContent =
    chrome.i18n.getMessage("requireKey", [altKeyName]);

  createLanguageOpt(sourceLanguageElement, chrome.i18n.getMessage("autoLanguage"), "auto");
  getLocalizedLanguages().forEach(function(language) {
    createLanguageOpt(sourceLanguageElement, language.name, language.code);
    createLanguageOpt(targetLanguageElement, language.name, language.code);
  });

  loadBuiltInSupportedLanguages();
  [sourceLanguageElement, targetLanguageElement].forEach(function(select) {
    // Both come before the list opens, keydown covers opening it from the keyboard
    ["mousedown", "keydown"].forEach(function(type) {
      select.addEventListener(type, function() {
        let useBuiltIn = document.querySelector('input[name="display"]:checked').value == "page";
        setLanguageMarks(select, useBuiltIn);
      });
    });
    ["change", "blur"].forEach(function(type) {
      select.addEventListener(type, function() {
        setLanguageMarks(select, false);
      });
    });
  });

  function updateDependentControls() {
    swapLanguagesElement.disabled = sourceLanguageElement.value == "auto";
    let useBuiltIn = document.querySelector('input[name="display"]:checked').value == "page";
    document.getElementById("translator-page-options").hidden = !useBuiltIn;
    document.getElementById("translator-google-options").hidden = useBuiltIn;
    if (useBuiltIn) {
      updatePageTranslationStatus(sourceLanguageElement, targetLanguageElement);
    }
    let checkedTrigger = document.querySelector('input[name="trigger"]:checked');
    let action = checkedTrigger ? checkedTrigger.value : "dbclick";
    document.getElementById("translator-hold-alt-option").hidden = action == "none";
    renderTriggerHint(action, document.getElementById("translator-hold-alt-to-translate").checked);
  }

  chrome.storage.sync.get([
    "translator_sourceLanguage",
    "translator_targetLanguage",
    "translator_translateInputAction",
    "translator_useBuiltIn",
    ...Object.keys(switchSettings)
  ], function(items) {
    let display = items["translator_useBuiltIn"] == false ? "google" : "page";
    displayElements.forEach(function(element) {
      element.checked = element.value == display;
    });
    sourceLanguageElement.value = items["translator_sourceLanguage"] || "auto";
    targetLanguageElement.value = items["translator_targetLanguage"] || "en";
    let action = items["translator_translateInputAction"] || "dbclick";
    triggerElements.forEach(function(element) {
      element.checked = element.value == action;
    });
    Object.keys(switchSettings).forEach(function(key) {
      let value = items[key];
      document.getElementById(switchSettings[key].id).checked = value != undefined ? value : switchSettings[key].defaultValue;
    });
    updateDependentControls();
    requestAnimationFrame(function() {
      document.querySelector(".popup").classList.remove("loading");
    });
  });

  sourceLanguageElement.addEventListener('change', function() {
    chrome.runtime.sendMessage({
      type: "changeLanguage",
      sourceLanguage: this.value
    });
    updateDependentControls();
  });

  targetLanguageElement.addEventListener('change', function() {
    chrome.runtime.sendMessage({
      type: "changeLanguage",
      targetLanguage: this.value
    });
    updateDependentControls();
  });

  swapLanguagesElement.addEventListener('click', function() {
    let sourceLanguage = sourceLanguageElement.value;
    sourceLanguageElement.value = targetLanguageElement.value;
    targetLanguageElement.value = sourceLanguage;
    chrome.runtime.sendMessage({
      type: "changeLanguage",
      sourceLanguage: sourceLanguageElement.value,
      targetLanguage: targetLanguageElement.value
    });
    updateDependentControls();
  });

  triggerElements.forEach(function(element) {
    element.addEventListener('change', function() {
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: this.value
      });
      updateDependentControls();
    });
  });

  displayElements.forEach(function(element) {
    element.addEventListener('change', function() {
      chrome.storage.sync.set({
        "translator_useBuiltIn": this.value == "page"
      });
      updateDependentControls();
    });
  });

  Object.keys(switchSettings).forEach(function(key) {
    document.getElementById(switchSettings[key].id).addEventListener('change', function() {
      chrome.storage.sync.set({
        [key]: this.checked
      });
      updateDependentControls();
    });
  });
});

let switchSettings = {
  "translator_holdAltToTranslate": { id: "translator-hold-alt-to-translate", defaultValue: false },
  "translator_replaceText": { id: "translator-replace-text", defaultValue: false },
  "translator_useOpenTab": { id: "translator-use-open-tab", defaultValue: true }
};

let altKeyName = /Mac/.test(navigator.platform) ? "⌥ Option" : "Alt";

// Mode switching shortcuts, handled in contentScript.js
let modeShortcutKeys = {
  "none": "1",
  "dbclick": "2",
  "tpclick": "3"
};

function renderTriggerHint(action, holdAlt) {
  let combo;
  let caption;
  if (action == "none") {
    combo = mouseIcon("right");
    caption = chrome.i18n.getMessage("hintOff");
  } else {
    let clicks = action == "tpclick" ? 3 : 2;
    combo = `${mouseIcon("left")}<span class="count">×${clicks}</span>`;
    if (holdAlt) {
      combo = `<span class="key">${altKeyName}</span><span class="plus">+</span>${combo}`;
    }
    let click = clicks == 3 ? "TripleClick" : "DoubleClick";
    caption = holdAlt ?
      chrome.i18n.getMessage(`hintHold${click}`, [altKeyName]) :
      chrome.i18n.getMessage(`hint${click}`);
  }
  document.getElementById("translator-trigger-hint").innerHTML =
    `<div class="combo">${combo}</div><div class="hint-caption">${caption}</div>
    <div class="shortcut">
      <span>${chrome.i18n.getMessage("switchToMode")}</span>
      <span class="keys"><span class="key">${altKeyName}</span><span class="plus">+</span><span class="key">${modeShortcutKeys[action]}</span></span>
    </div>`;
}

let pageTranslationStatusRequest = 0;

async function updatePageTranslationStatus(sourceLanguageElement, targetLanguageElement) {
  let request = ++pageTranslationStatusRequest;
  let pair = `${sourceLanguageElement.selectedOptions[0].dataset.name} → ${targetLanguageElement.selectedOptions[0].dataset.name}`;
  let status = await getPageTranslationStatus(sourceLanguageElement.value, targetLanguageElement.value, pair);
  // Languages may have changed while availability was being checked
  if (request != pageTranslationStatusRequest) {
    return;
  }
  let element = document.getElementById("translator-page-status");
  element.classList.toggle("warn", !status.ok);
  // Supported pairs get the usual caption, only problems are highlighted
  element.innerHTML = status.ok ? "" : warningIcon();
  let text = document.createElement("span");
  text.textContent = status.message;
  element.appendChild(text);
}

async function getPageTranslationStatus(sourceLanguage, targetLanguage, pair) {
  if (!("Translator" in self)) {
    return { ok: false, message: chrome.i18n.getMessage("statusNoBuiltIn") };
  }
  if (sourceLanguage == targetLanguage) {
    return { ok: false, message: chrome.i18n.getMessage("statusSameLanguage") };
  }
  let target = toBuiltInLanguageCode(targetLanguage);
  // With auto-detection the source is only known after translation starts, so check just the target language
  let source = sourceLanguage == "auto" ?
    (target == "en" ? "es" : "en") :
    toBuiltInLanguageCode(sourceLanguage);
  let availability;
  try {
    availability = await Translator.availability({ sourceLanguage: source, targetLanguage: target });
  } catch (e) {
    availability = "unavailable";
  }
  return availability == "unavailable" ?
    { ok: false, message: chrome.i18n.getMessage("statusUnsupported", [pair]) } :
    { ok: true, message: chrome.i18n.getMessage("onPageCaption") };
}

function warningIcon() {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 1.5l6 11H1zM7 6v3M7 10.8v.1" />
    </svg>`;
}

function mouseIcon(pressedButton) {
  let pressedPath = pressedButton == "left" ?
    "M11 1A10 10 0 0 0 1 11V13H11Z" :
    "M11 1A10 10 0 0 1 21 11V13H11Z";
  return `<svg class="mouse" width="22" height="32" viewBox="0 0 22 32" aria-hidden="true">
      <path class="pressed" d="${pressedPath}" />
      <rect x="1" y="1" width="20" height="30" rx="10" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M1 13H21M11 1V13" stroke="currentColor" stroke-width="1.5" />
    </svg>`;
}

// Fill elements marked with data-i18n attributes from _locales/*/messages.json
function localizePage() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.querySelectorAll("[data-i18n]").forEach(function(element) {
    element.textContent = chrome.i18n.getMessage(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(function(element) {
    element.title = chrome.i18n.getMessage(element.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(function(element) {
    element.setAttribute("aria-label", chrome.i18n.getMessage(element.dataset.i18nAriaLabel));
  });
}

// Google Translate codes whose name Intl.DisplayNames gets wrong or doesn't know
let displayNameCodes = {
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
  "pt": "pt-BR",
  "jw": "jv"
};

// Language names in the browser UI language, sorted alphabetically in that language
function getLocalizedLanguages() {
  let uiLanguage = chrome.i18n.getUILanguage();
  let displayNames = new Intl.DisplayNames([uiLanguage], { type: "language", fallback: "none" });
  let result = [];
  languages.forEach(function(code, englishName) {
    // Chrome ships names for a limited set of languages, the rest come from lang_* messages
    let name = chrome.i18n.getMessage("lang_" + code.replace(/-/g, "_"));
    try {
      name = name || displayNames.of(displayNameCodes[code] || code);
    } catch (e) {
      // Not a valid BCP 47 tag
    }
    result.push({ code, name: name ? capitalize(name, uiLanguage) : englishName });
  });
  return result.sort(function(a, b) {
    return a.name.localeCompare(b.name, uiLanguage);
  });
}

function capitalize(text, locale) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

function createLanguageOpt(parent, key, value) {
  let option = document.createElement("option");
  option.value = value;
  option.innerHTML = key;
  // Keep the plain name, the visible text may get an "on page" mark
  option.dataset.name = option.textContent;
  parent.appendChild(option);
}

// Codes of the languages Chrome's built-in translator supports, filled once when the popup opens
let builtInSupportedLanguages = new Set();

function loadBuiltInSupportedLanguages() {
  let codes = Array.from(languages.values());
  Promise.all(codes.map(isBuiltInSupported)).then(function(results) {
    builtInSupportedLanguages = new Set(codes.filter(function(code, i) {
      return results[i];
    }));
  });
}

async function isBuiltInSupported(code) {
  if (!("Translator" in self)) {
    return false;
  }
  let target = toBuiltInLanguageCode(code);
  // Availability is checked per pair, so pair the language with English (or English with Spanish)
  let source = target == "en" ? "es" : "en";
  try {
    return await Translator.availability({ sourceLanguage: source, targetLanguage: target }) != "unavailable";
  } catch (e) {
    return false;
  }
}

// Marks are shown only while a list is open: a closed list is too narrow for "Japanese · on page"
function setLanguageMarks(select, show) {
  let mark = chrome.i18n.getMessage("onPageMark");
  Array.from(select.options).forEach(function(option) {
    option.textContent = show && builtInSupportedLanguages.has(option.value) ?
      `${option.dataset.name} · ${mark}` :
      option.dataset.name;
  });
}

let languages = new Map([
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
  ["Venda", "ve"],
  ["Venetian", "vec"],
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
]);
