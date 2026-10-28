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

// "Download" button the translation popup embeds when Bergamot has no access to its models yet.
// The click happens on an extension page, so it can request the access. The content script is told by
// postMessage with the id from the URL and checks the access itself

let id = location.hash.slice(1);
let button = document.getElementById("download");
button.textContent = chrome.i18n.getMessage("download");

function tell(message) {
  window.parent.postMessage({ id, ...message }, "*");
}

button.addEventListener("click", function() {
  button.disabled = true;
  chrome.permissions.request({ origins: [bergamotModelsOrigin] }).catch(function(error) {
    console.debug("Translator: requesting access to Bergamot models failed", error);
  }).finally(function() {
    tell({ type: "answered" });
  });
});

tell({ type: "ready", width: button.offsetWidth, height: button.offsetHeight });
