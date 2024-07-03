function extractKeywordsFromAPI(text) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'extractKeywords', text: text },
            response => {
                if (response && response.keywords) {
                    console.log('Extracted keywords:', response.keywords); // Log keywords for debugging
                    resolve(response.keywords);
                } else {
                    console.error('Keyword extraction failed:', response);
                    reject('Failed to extract keywords');
                }
            }
        );
    });
}

function highlightKeywords(keywords) {
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        document.body.innerHTML = document.body.innerHTML.replace(regex, `<span class="highlight">${keyword}</span>`);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const text = document.body.innerText;
    extractKeywordsFromAPI(text).then(keywords => {
        highlightKeywords(keywords);
    }).catch(error => console.error('Error:', error));
});
