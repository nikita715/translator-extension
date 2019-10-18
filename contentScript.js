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

function changeActiveAction(value) {
  var translateActionTypes = document.getElementsByClassName("translate-input-type");
  for (let j = 0; j < translateActionTypes.length; j++) {
    translateActionTypes[j].parentNode.classList.remove("active");
  }
  let element = document.getElementById("translate-input-type-" + value);
  element.parentNode.classList.add("active");
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
