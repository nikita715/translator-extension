document.body.addEventListener('dblclick', function (e) {
  let text = window.getSelection().toString();

  if (!isBlank(text)) {
    chrome.runtime.sendMessage({
      type: "translate",
      text
    });
  }
});

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}
