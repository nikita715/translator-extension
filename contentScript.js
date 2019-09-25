document.body.addEventListener('dblclick', function(e) {
  let text = window.getSelection().toString();
  chrome.runtime.sendMessage({
    text: text
  }, function(response) {
    let translation = JSON.parse(response).text[0];
    if (!isBlank(translation)) {
      createTranslationElement(e, translation);
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
  console.log(x);
  console.log(y);
  var element = document.createElement("p");
  element.style = "top:" + y + "px;left:" + x + "px;";
  element.id = "chrome-extension-translation";
  element.appendChild(document.createTextNode(translation));
  document.body.appendChild(element);
}

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}
