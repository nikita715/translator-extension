document.body.addEventListener('dblclick', function (e) {
  translate(window.getSelection().toString());
});

function translate(text){
    return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({text: text}, function (response) {
            console.log(JSON.parse(response).text[0]);
        });
    });
}