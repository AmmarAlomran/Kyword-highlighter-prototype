function elementReady(getter, opts = {}) {
    return new Promise((resolve, reject) => {
        opts = Object.assign({
            timeout: 0,
            target: document.documentElement
        }, opts);

        const returnMultipleElements = getter instanceof Array && getter.length === 1;
        const _getter = typeof getter === 'function'
            ? mutationRecords => { try { return getter(mutationRecords); } catch { return false; } }
            : () => returnMultipleElements ? document.querySelectorAll(getter[0]) : document.querySelector(getter);

        const resolveIfReady = (mutationRecords) => {
            const result = _getter(mutationRecords || {});
            if (result && (!returnMultipleElements || result.length)) {
                resolve(result);
                return true;
            }
        };

        if (resolveIfReady()) return;

        if (opts.timeout) {
            setTimeout(() => reject(new Error(`elementReady(${getter}) timed out at ${opts.timeout}ms`)), opts.timeout);
        }

        new MutationObserver((mutationRecords, observer) => {
            if (resolveIfReady(mutationRecords)) observer.disconnect();
        }).observe(opts.target, { childList: true, subtree: true });
    });
}

function fetchFromAPI(action, body) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action, ...body }, response => {
            if (response && !response.error) {
                resolve(response);
            } else {
                console.error(`${action} failed:`, response);
                reject(response.error || `Failed to ${action}`);
            }
        });
    });
}

function highlightKeywords(keywords) {
    const pattern = keywords.map(keyword => `\\b${escapeRegExp(keyword.trim())}\\b`).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    function traverseNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (shouldHighlight(node) && node.textContent.match(regex)) {
                const span = document.createElement('span');
                span.innerHTML = node.textContent.replace(regex, match => `<span class="highlighted">${match}</span>`);
                node.parentNode.replaceChild(span, node);
                span.querySelectorAll('.highlighted').forEach(word => {
                    word.addEventListener('click', event => {
                        const selectedText = word.textContent.trim();
                        fetchExplanation(selectedText).then(explanation => {
                            showModal(explanation, word);
                        }).catch(error => console.error('Error fetching explanation:', error));
                    });
                    word.addEventListener('mouseenter', () => word.classList.add('highlighted-hover'));
                    word.addEventListener('mouseleave', () => word.classList.remove('highlighted-hover'));
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            Array.from(node.childNodes).forEach(traverseNodes);
        }
    }

    traverseNodes(getMainContent());
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shouldHighlight(node) {
    const includeTags = ['P', 'CODE', 'SPAN', 'LI', 'TD', 'TH', 'A'];
    let current = node;
    while (current && current !== document.body) {
        if (current.nodeType === Node.ELEMENT_NODE && current.classList.contains('div.highlight')) {
            return false;
        }
        if (current.nodeName === 'PRE') {
            return false;
        }
        if (includeTags.includes(current.nodeName)) return true;
        current = current.parentElement;
    }
    return false;
}

function getMainContent() {
    const contentSelectors = ['.main-content', 'article', '.post-content', '#content'];
    for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
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
    return new Promise((resolve, reject) => {
        let modal = document.getElementById('explanationModal');
        if (!modal) {
            console.log('Creating modal...');
            fetch(chrome.runtime.getURL('modal.html'))
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok.');
                    }
                    return response.text();
                })
                .then(html => {
                    console.log('Modal HTML fetched.');
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html.trim(); // Trim to remove any unwanted spaces
                    document.body.appendChild(tempDiv.firstChild);

                    modal = document.getElementById('explanationModal');
                    if (modal) {
                        console.log('Modal appended to body.');
                        modal.querySelector('.close').onclick = function() {
                            hideModal();
                        };

                        // Insert CSS dynamically
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.type = 'text/css';
                        link.href = chrome.runtime.getURL('styles.css');
                        document.head.appendChild(link);

                        resolve(modal);
                    } else {
                        console.error('Modal not found after appending to body.');
                        reject(new Error('Modal not created properly'));
                    }
                })
                .catch(error => {
                    console.error('Error loading modal HTML:', error);
                    reject(error);
                });
        } else {
            resolve(modal);
        }
    });
}

function showModal(text, targetElement) {
    createModal().then(modal => {
        const explanationText = document.getElementById('explanationText');
        const modalTitle = document.getElementById('modalTitle');

        if (explanationText && modalTitle) {
            explanationText.innerText = text;

            if (modal && targetElement) {
                const rect = targetElement.getBoundingClientRect();
                modal.style.top = `${window.scrollY + rect.bottom + 5}px`;
                modal.style.left = `${window.scrollX + rect.left}px`;
                modal.style.display = 'block';
            } else {
                console.error('Modal element or target element is not available to show.');
            }
        } else {
            console.error('Modal elements not created properly: explanationText:', explanationText, 'modalTitle:', modalTitle);
        }
    }).catch(error => console.error('Error creating modal:', error));
}

function hideModal() {
    const modal = document.getElementById('explanationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function initializeContentScript() {
    createModal().then(() => {
        const contentElement = getMainContent();
        if (contentElement) {
            const text = contentElement.innerText;
            fetchFromAPI('extractKeywords', { text })
                .then(response => highlightKeywords(response.keywords))
                .catch(error => console.error('Error extracting keywords:', error));
        }
    }).catch(error => console.error('Error initializing content script:', error));
}

elementReady('body').then(initializeContentScript);
document.addEventListener('mousedown', hideModal);