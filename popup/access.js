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

// Window that asks for access to Bergamot's models when a page wants to download one.
// background.js waits for the window to close and checks whether the access was granted

document.documentElement.dir = chrome.i18n.getMessage("@@bidi_dir");
document.querySelectorAll("[data-i18n]").forEach(function(element) {
  element.textContent = chrome.i18n.getMessage(element.dataset.i18n);
});

document.getElementById("allow").addEventListener("click", function() {
  chrome.permissions.request({ origins: [bergamotModelsOrigin] }).finally(function() {
    window.close();
  });
});

document.getElementById("cancel").addEventListener("click", function() {
  window.close();
});
