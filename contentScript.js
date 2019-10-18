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
      text
    });
  }
}

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

function notInputTag(element) {
  let tagName = element.tagName;
  console.log(tagName);
  return tagName != "INPUT" && tagName != "TEXTAREA" && tagName != "OPTION";
}
