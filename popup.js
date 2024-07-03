chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SHOW_EXPLANATION") {
        document.getElementById('explanation').innerText = message.explanation;
    }
});
