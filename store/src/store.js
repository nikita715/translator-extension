// Fills a store image with the texts of one language: ?lang=ru takes texts/ru.json, missing texts come
// from texts/en.json. The popups open in the same language
let storeLanguage = new URLSearchParams(location.search).get("lang") || "en";

function loadJson(path) {
  let xhr = new XMLHttpRequest();
  xhr.open("GET", path, false);
  try {
    xhr.send();
    return JSON.parse(xhr.responseText);
  } catch (error) {
    return {};
  }
}

let storeTexts = Object.assign(loadJson("texts/en.json"), loadJson(`texts/${storeLanguage}.json`));
let storeMessages = loadJson(`_locales/${storeLanguage}/messages.json`);
// The page being translated, from texts/articles.json: Japanese for languages written in Latin or Cyrillic,
// English for the others
let storeArticle = loadJson("texts/articles.json")[storeTexts.article];

function getLanguageName(code) {
  return storeMessages["lang_" + code.replace(/-/g, "_")].message;
}

document.documentElement.lang = storeLanguage.replace("_", "-");
document.documentElement.dir = storeLanguage == "ar" ? "rtl" : "ltr";
document.querySelectorAll("[data-text]").forEach(function(element) {
  element.innerHTML = storeTexts[element.dataset.text];
});
document.querySelectorAll("[data-article]").forEach(function(element) {
  element.textContent = storeArticle[element.dataset.article];
});
document.querySelectorAll("[data-article-lang]").forEach(function(element) {
  element.lang = storeArticle.lang;
});
document.querySelectorAll("[data-source-code]").forEach(function(element) {
  element.textContent = storeArticle.languages[0].split("-")[0];
});
// Source language choices, the detected language first
document.querySelectorAll(".languages").forEach(function(element) {
  element.textContent = storeMessages.sourceLanguageLabel.message;
  storeArticle.languages.forEach(function(code, index) {
    let choice = document.createElement("b");
    choice.textContent = getLanguageName(code);
    choice.classList.toggle("on", index == 0);
    element.appendChild(choice);
  });
});
document.querySelectorAll("iframe").forEach(function(frame) {
  frame.src = `${frame.getAttribute("src")}&lang=${storeLanguage}&src=${storeArticle.languages[0]}`;
});
// Long translations get a smaller font instead of overlapping other texts
document.querySelectorAll("[data-fit]").forEach(function(element) {
  let size = parseFloat(getComputedStyle(element).fontSize);
  while (element.offsetHeight > Number(element.dataset.fit) && size > 8) {
    element.style.fontSize = `${--size}px`;
  }
});
