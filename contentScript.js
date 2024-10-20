/*
   Copyright 2019 - 2024 Nikita Stepochkin

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

document.body.addEventListener('dblclick', function(e) {
  let text = window.getSelection().toString();
  sendToTranslate(e, "dbclick", text);
});

document.body.addEventListener('click', function(e) {
  if (e.detail === 3) {
    let text = window.getSelection().toString();
    sendToTranslate(e, "tpclick", text);
  }
});

function sendToTranslate(e, action, text) {
  if (!isBlank(text) && notInputTag(e.target)) {
    chrome.runtime.sendMessage({
      action: action,
      type: "translate",
      altActive: e.altKey,
      text
    });
  }
}

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

document.onkeyup = function(e) {
  if (e.altKey) {
    if (e.which == 49) {
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: "none"
      });
    } else if (e.which == 50) {
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: "dbclick"
      });
    } else if (e.which == 51) {
      chrome.runtime.sendMessage({
        type: "changeAction",
        value: "tpclick"
      });
    }
  }
};

function notInputTag(element) {
  let tagName = element.tagName;
  return tagName != "INPUT" && tagName != "TEXTAREA" && tagName != "OPTION";
}
