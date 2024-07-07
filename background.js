chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractKeywords') {
        fetch('http://127.0.0.1:5000/extract_keywords', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: message.text })
        })
        .then(response => response.json())
        .then(data => {
            sendResponse({ keywords: data.keywords });
        })
        .catch(error => {
            console.error('Error extracting keywords:', error);
            sendResponse({ error: 'Failed to extract keywords' });
        });
        return true; // Indicate that sendResponse will be called asynchronously
    } else if (message.action === 'fetchExplanation') {
        fetch('http://127.0.0.1:5000/get_explanation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keyword: message.keyword })
        })
        .then(response => response.json())
        .then(data => {
            sendResponse({ explanation: data.explanation });
        })
        .catch(error => {
            console.error('Error fetching explanation:', error);
            sendResponse({ error: 'Failed to fetch explanation' });
        });
        return true; // Indicate that sendResponse will be called asynchronously
    }
});
