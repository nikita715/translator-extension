// Stands in for the chrome.* and Translator APIs when the popup is rendered for store images.
// Query parameters: a = trigger mode, alt = require Alt, r = replace text, crop = hide the Alt switch,
// e = default engine, languages = open the supported languages, scroll = element id to scroll to
let q = new URLSearchParams(location.search);
// Show "Alt" instead of "⌥ Option"
Object.defineProperty(navigator, "platform", { get: () => "Win32" });
function loadMessages(locale) {
  let xhr = new XMLHttpRequest();
  xhr.open("GET", `../_locales/${locale}/messages.json`, false);
  xhr.send();
  return JSON.parse(xhr.responseText);
}
let messages = loadMessages("en");
window.chrome = {
  i18n: {
    getUILanguage: () => "en",
    getMessage(key, substitutions) {
      if (key == "@@bidi_dir") return "ltr";
      let entry = messages[key];
      if (!entry) return "";
      let text = entry.message;
      for (let [name, placeholder] of Object.entries(entry.placeholders || {})) {
        let value = placeholder.content.replace(/\$(\d)/, (m, i) => (substitutions || [])[i - 1]);
        text = text.replace(new RegExp("\\$" + name + "\\$", "gi"), value);
      }
      return text;
    }
  },
  storage: {
    sync: {
      get: (keys, callback) => callback({
        translator_sourceLanguage: "ja",
        translator_targetLanguage: "en",
        translator_translateInputAction: q.get("a") || "dbclick",
        translator_holdAltToTranslate: q.get("alt") == "1",
        translator_useBuiltIn: true,
        translator_replaceText: q.get("r") == "1",
        translator_useOpenTab: true,
        translator_engine: q.get("e") || "chrome",
        translator_googleFallback: false,
        translator_askBeforeDownload: true
      }),
      set() {}
    }
  },
  permissions: { contains: async () => true, request: async () => true },
  runtime: { id: "store", sendMessage() {} }
};
document.addEventListener("DOMContentLoaded", () => {
  // The supported languages are filled after the engine checks them
  setTimeout(() => {
    if (q.get("languages") == "1") {
      document.getElementById("translator-engine-languages").open = true;
    }
    if (q.get("scroll")) {
      document.getElementById(q.get("scroll")).scrollIntoView();
    }
  }, 1000);
});
// Languages Chrome's built-in translator supports
const builtIn = "ar bg bn cs da de el en es fi fr he hi hr hu id it ja kn ko lt mr nl no pl pt ro ru sk sl sv ta te th tr uk vi zh zh-Hant".split(" ");
window.Translator = {
  availability: async ({ sourceLanguage, targetLanguage }) =>
    builtIn.includes(sourceLanguage) && builtIn.includes(targetLanguage) ? "downloadable" : "unavailable"
};
if (q.get("crop") == "1") {
  document.addEventListener("DOMContentLoaded", () => {
    let style = document.createElement("style");
    style.textContent = "#translator-hold-alt-option { display: none !important; }";
    document.head.appendChild(style);
  });
}
