document.body.addEventListener('dblclick', function(e) {
  let text = window.getSelection().toString();

  chrome.runtime.sendMessage({
    type: "findTab",
    text: text
  }, function(response) {
    console.log(response);
    if (!response) {
      chrome.runtime.sendMessage({
        type: "createTab",
        text: text
      }, function(response) {
        console.log(response);
      });
    }
  });
});

document.body.addEventListener('click', function(e) {
  let element = document.getElementById("chrome-extension-translation");
  if (element) {
    element.remove();
  }
});

function createTranslationElement(event, translation) {
  var x = event.clientX;
  var y = event.clientY + event.target.offsetHeight;
  var element = document.createElement("p");
  element.style = "top:" + y + "px;left:" + x + "px;";
  element.id = "chrome-extension-translation";
  element.appendChild(document.createTextNode(translation));
  document.body.appendChild(element);
}

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}
