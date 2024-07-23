chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleFetch = (url, body) => {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })
        .then(response => response.json())
        .then(data => sendResponse(data))
        .catch(error => {
            console.error(`Error with ${message.action}:`, error);
            sendResponse({ error: `Failed to ${message.action}` });
        });
        return true; // Indicate that sendResponse will be called asynchronously
    };

    switch (message.action) {
        case 'extractKeywords':
            return handleFetch('http://127.0.0.1:5000/extract_keywords', { text: message.text });
        default:
            console.error('Unknown action:', message.action);
            sendResponse({ error: 'Unknown action' });
            return false;
    }
});
