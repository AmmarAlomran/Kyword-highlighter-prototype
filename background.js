chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractKeywords') {
        fetch('http://127.0.0.1:5000/extract_keywords', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: request.text })
        })
        .then(response => response.json())
        .then(data => sendResponse({ keywords: data.keywords }))
        .catch(error => {
            console.error('Error:', error);
            sendResponse({ error: 'Failed to extract keywords' });
        });
        return true; // Indicates that sendResponse will be called asynchronously
    }
});
