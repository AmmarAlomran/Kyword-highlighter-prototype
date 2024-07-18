function elementReady(getter, opts = {}) {
    return new Promise((resolve, reject) => {
        opts = Object.assign({
            timeout: 0,
            target: document.documentElement
        }, opts);
        const returnMultipleElements = getter instanceof Array && getter.length === 1;
        let _timeout;
        const _getter = typeof getter === 'function' ?
            (mutationRecords) => {
                try {
                    return getter(mutationRecords);
                } catch (e) {
                    return false;
                }
            } :
            () => returnMultipleElements ? document.querySelectorAll(getter[0]) : document.querySelector(getter)
        ;
        const computeResolveValue = function (mutationRecords) {
            const ret = _getter(mutationRecords || {});
            if (ret && (!returnMultipleElements || ret.length)) {
                resolve(ret);
                clearTimeout(_timeout);
                return true;
            }
        };

        if (computeResolveValue(_getter())) {
            return;
        }

        if (opts.timeout)
            _timeout = setTimeout(() => {
                const error = new Error(`elementReady(${getter}) timed out at ${opts.timeout}ms`);
                reject(error);
            }, opts.timeout);

        new MutationObserver((mutationRecords, observer) => {
            const completed = computeResolveValue(_getter(mutationRecords));
            if (completed) {
                observer.disconnect();
            }
        }).observe(opts.target, {
            childList: true,
            subtree: true
        });
    });
}

function extractKeywordsFromAPI(text) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'extractKeywords', text: text },
            response => {
                if (response && response.keywords) {
                    console.log('Extracted keywords:', response.keywords);
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
    const pattern = keywords.map(keyword => `\\b${escapeRegExp(keyword.trim())}\\b`).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    function shouldHighlight(node) {
        const includeTags = ['P', 'CODE', 'SPAN', 'LI', 'TD', 'TH', 'A'];
        let current = node;
        while (current && current !== document.body) {
            if (current.nodeType === Node.ELEMENT_NODE && current.classList.contains('div.highlight')) {
                console.log('Skipping node due to highlight class:', current);
                return false;
            }
            if (current.nodeName === 'PRE') {
                console.log('Skipping node inside PRE:', current);
                return false;
            }
            if (includeTags.includes(current.nodeName)) return true;
            current = current.parentElement;
        }
        return false;
    }

    function traverseNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (shouldHighlight(node) && node.textContent.match(regex)) {
                const span = document.createElement('span');
                span.innerHTML = node.textContent.replace(regex, match => `<span class="highlighted">${match}</span>`);
                node.parentNode.replaceChild(span, node);
                span.querySelectorAll('.highlighted').forEach(word => {
                    word.addEventListener('click', () => {
                        const selectedText = word.textContent.trim();
                        fetchExplanation(selectedText).then(explanation => {
                            showModal(explanation);
                        }).catch(error => console.error('Error fetching explanation:', error));
                    });
                    word.addEventListener('mouseenter', () => {
                        word.classList.add('highlighted-hover');
                    });
                    word.addEventListener('mouseleave', () => {
                        word.classList.remove('highlighted-hover');
                    });
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            Array.from(node.childNodes).forEach(traverseNode);
        }
    }

    traverseNode(getMainContent());
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMainContent() {
    const contentSelectors = [
        '.main-content',
        'article',
        '.post-content',
        '#content'
    ];
    
    for (let selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('Found content container:', selector);
            return element;
        }
    }
    
    console.log('No specific content container found, using body');
    return document.body;
}

function fetchExplanation(keyword) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'fetchExplanation', keyword: keyword },
            response => {
                if (response && response.explanation) {
                    console.log('Received explanation:', response.explanation);
                    resolve(response.explanation);
                } else {
                    console.error('Explanation fetching failed:', response);
                    reject('Failed to fetch explanation');
                }
            }
        );
    });
}

function createModal() {
    let modal = document.getElementById('explanationModal');
    if (!modal) {
        fetch(chrome.runtime.getURL('modal.html'))  // Assuming the modal.html is in your Chrome extension's root directory
            .then(response => response.text())
            .then(html => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                modal = tempDiv.firstChild;
                document.body.appendChild(modal);

                modal.querySelector('.close').onclick = function() {
                    hideModal();
                };

                window.onclick = function(event) {
                    if (event.target == modal) {
                        hideModal();
                    }
                };
            })
            .catch(error => console.error('Error loading modal HTML:', error));
    }
}

function showModal(text) {
    createModal();
    const explanationText = document.getElementById('explanationText');
    explanationText.innerText = text;
    const modal = document.getElementById('explanationModal');
    modal.style.display = 'block';
}

function hideModal() {
    const modal = document.getElementById('explanationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

elementReady('body').then(function (body) {
    const contentElement = getMainContent();
    if (contentElement) {
        const text = contentElement.innerText;
        console.log('Extracting keywords from:', text);
        extractKeywordsFromAPI(text).then(keywords => {
            highlightKeywords(keywords);
        }).catch(error => console.error('Error:', error));
    }
});

document.addEventListener('mousedown', () => {
    hideModal();
});