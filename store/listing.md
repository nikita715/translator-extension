# Chrome Web Store listing

Texts to paste into the developer dashboard. The short description comes from `extDescription` in `_locales`.

## Description (English)

Translate words and paragraphs with a click, right on the page. On-page translation runs in your browser and works offline.

HOW IT WORKS
• Double-click a word or triple-click a paragraph, the translation appears next to it
• Or turn on "Replace selected text": the translation takes the place of the original, links and formatting stay. One click brings the original back
• The right-click menu translates any selected text
• Switch modes on any page with Alt+1, Alt+2, Alt+3. Hold Alt while clicking so the translator doesn't get in the way of normal clicks

WORKS OFFLINE
• Language packs download once, then translation works without the internet
• Two offline translators cover dozens of languages: if one doesn't support your languages, the other one translates them automatically

SMART LANGUAGE DETECTION
• The source language is detected automatically, short words are checked against the whole paragraph
• Not the right language? The likely languages are shown above the translation, pick another one with a click
• Languages whose packs are already downloaded come first, so the translation shows up at once

YOUR CONTROL
• The extension asks before downloading a language pack (tens of megabytes)
• Google Translate is an optional fallback, off by default
• The interface is available in 23 languages

PRIVACY
On-page translation happens on your device: only language packs are downloaded, from Google and Mozilla servers. If you choose Google Translate or turn on the Google Translate fallback, the selected text is opened on translate.google.com. The extension doesn't collect any data.

## Описание (русский)

Переводите слова и абзацы одним кликом прямо на странице. Перевод на странице выполняется в браузере и работает офлайн.

КАК ЭТО РАБОТАЕТ
• Дважды щёлкните по слову или трижды по абзацу — перевод появится рядом
• Или включите «Заменять выделенный текст»: перевод встанет на место оригинала, ссылки и оформление сохранятся. Оригинал возвращается одним кликом
• Пункт контекстного меню переводит любой выделенный текст
• Режимы переключаются на любой странице сочетаниями Alt+1, Alt+2, Alt+3. Можно требовать зажатый Alt, чтобы переводчик не мешал обычным кликам

РАБОТАЕТ ОФЛАЙН
• Языковые пакеты скачиваются один раз, дальше перевод работает без интернета
• Два офлайн-переводчика покрывают десятки языков: если один не поддерживает ваши языки, автоматически переведёт другой

УМНОЕ ОПРЕДЕЛЕНИЕ ЯЗЫКА
• Исходный язык определяется автоматически, короткие слова проверяются по всему абзацу
• Язык определился неверно? Над переводом показаны возможные языки — выберите другой одним кликом
• Сначала предлагаются языки, пакеты которых уже скачаны, поэтому перевод появляется сразу

ВСЁ ПОД КОНТРОЛЕМ
• Перед скачиванием языкового пакета (десятки мегабайт) расширение спрашивает разрешение
• Google Переводчик — необязательный запасной вариант, по умолчанию выключен
• Интерфейс на 23 языках

КОНФИДЕНЦИАЛЬНОСТЬ
Перевод на странице выполняется на вашем устройстве: скачиваются только языковые пакеты, с серверов Google и Mozilla. Если вы выберете Google Переводчик или включите его как запасной вариант, выделенный текст откроется на translate.google.com. Расширение не собирает никаких данных.

## What's new in 3.0

• A second offline translator: more languages work without the internet
• When the default translator doesn't support your languages, the other one takes over
• Pick the source language right in the translation popup and next to replaced text
• Asks before downloading language packs
• Google Translate fallback is optional and off by default

## Permission justifications

**activeTab, host permission for translate.google.com** — opens the selected text in Google Translate when the user chooses Google Translate or turns on the fallback.

**storage** — keeps the extension's settings: languages, trigger mode, default engine.

**contextMenus** — adds "Translate" to the right-click menu for selected text.

**offscreen** — Bergamot runs as WebAssembly in a Web Worker. Service workers can't start workers, so the engine runs in an offscreen document with the WORKERS reason.

**Optional host permission for storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/** — downloads Bergamot language models from Mozilla's public storage. The storage doesn't send CORS headers, so the extension needs host access to read the files. It's requested only when the user chooses Bergamot or agrees to download a Bergamot language pack.

**Content script on all sites** — shows the translation next to the selected text or replaces it on any page the user reads. The script reacts only to the user's clicks and selection.

**web_accessible_resources: popup/access-button.html** — the "Download" button shown in the translation popup when Bergamot has no access to its models yet. It's an extension page, so a click on it can request the optional host permission directly.

**Remote code** — none. The Bergamot engine (WebAssembly) is bundled with the extension; only language model data files are downloaded.

**Data usage** — the extension doesn't collect user data. On-page translation happens on the device. Text is sent to Google Translate only when the user chooses Google Translate mode or turns on the fallback: the extension opens translate.google.com with the selected text.
