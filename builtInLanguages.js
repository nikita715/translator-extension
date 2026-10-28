/*
   Copyright 2019 - 2026 Nikita Stepochkin

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

// Shared by contentScript.js and the popup

// Google Translate codes that differ from the BCP 47 tags used by Chrome Translator API
let builtInLanguageCodes = {
  "iw": "he",
  "jw": "jv",
  "zh-CN": "zh",
  "zh-TW": "zh-Hant"
};

function toBuiltInLanguageCode(code) {
  return builtInLanguageCodes[code] || code;
}
