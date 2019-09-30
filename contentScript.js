document.body.addEventListener('dblclick', function (e) {
  let text = window.getSelection().toString();

  if (!isBlank(text) && notInputTag(e.target)) {
    chrome.runtime.sendMessage({
      type: "translate",
      text
    });
  }
});

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

function notInputTag(element) {
  let tagName = element.tagName;
  console.log(tagName);
  return tagName != "INPUT" && tagName != "TEXTAREA" && tagName != "OPTION";
}
