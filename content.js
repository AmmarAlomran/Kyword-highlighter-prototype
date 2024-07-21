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
                    word.addEventListener('click', () => handleWordClick(word.textContent.trim()));
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
        if (current.nodeType === Node.ELEMENT_NODE && current.classList.contains('highlight')) {
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

function handleWordClick(keyword) {
    fetchFromAPI('fetchExplanation', { keyword })
        .then(response => showModal(response.explanation))
        .catch(error => console.error('Error fetching explanation:', error));
}

function createModal() {
    let modal = document.getElementById('explanationModal');
    if (!modal) {
        fetch(chrome.runtime.getURL('modal.html'))
            .then(response => response.text())
            .then(html => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html.trim(); // Trim to remove any unwanted spaces
                document.body.appendChild(tempDiv.firstChild);

                modal = document.getElementById('explanationModal');
                modal.querySelector('.close').onclick = function() {
                    hideModal();
                };
                window.onclick = function(event) {
                    if (event.target == modal) {
                        hideModal();
                    }
                };

                // Insert CSS dynamically
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.type = 'text/css';
                link.href = chrome.runtime.getURL('styles.css');
                document.head.appendChild(link);
            })
            .catch(error => console.error('Error loading modal HTML:', error));
    }
}

function showModal(text) {
    createModal();
    const explanationText = document.getElementById('explanationText');
    if (explanationText) {
        explanationText.innerText = text;
        const modal = document.getElementById('explanationModal');
        if (modal) {
            modal.style.display = 'block';
        }
    } else {
        console.error('Modal not created properly');
    }
}

function hideModal() {
    const modal = document.getElementById('explanationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

elementReady('body').then(() => {
    const contentElement = getMainContent();
    if (contentElement) {
        const text = contentElement.innerText;
        fetchFromAPI('extractKeywords', { text })
            .then(response => highlightKeywords(response.keywords))
            .catch(error => console.error('Error extracting keywords:', error));
    }
});

document.addEventListener('mousedown', hideModal);
