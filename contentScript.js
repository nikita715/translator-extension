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

let activeKey;

function sendToTranslate(e, action, text) {
  if (!isBlank(text) && notInputTag(e.target)) {
    chrome.runtime.sendMessage({
      action: action,
      type: "translate",
      activeKey,
      text
    });
  }
}

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

document.onkeyup = function(e) {
  activeKey = null;
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
  console.log(activeKey);
};

document.onkeydown = function(e) {
  activeKey = e.key;
  console.log(activeKey);
}

function notInputTag(element) {
  let tagName = element.tagName;
  return tagName != "INPUT" && tagName != "TEXTAREA" && tagName != "OPTION";
}
