/**
 *
 * @param {(String|String[]|Function)} getter -
 *      string: selector to return a single element
 *      string[]: selector to return multiple elements (only the first selector will be taken)
 *      function: getter(mutationRecords|{})-> Element[]
 *          a getter function returning an array of elements (the return value will be directly passed back to the promise)
 *          the function will be passed the `mutationRecords`
 * @param {Object} opts
 * @param {Number=0} opts.timeout - timeout in milliseconds, how long to wait before throwing an error (default is 0, meaning no timeout (infinite))
 * @param {Element=} opts.target - element to be observed
 *
 * @returns {Promise<Element>} the value passed will be a single element matching the selector, or whatever the function returned
 */
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
            // see if it already exists
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
                // Add click listener to each highlighted word
                span.querySelectorAll('.highlighted').forEach(word => {
                    word.addEventListener('click', () => {
                        const selectedText = word.textContent.trim();
                        fetchExplanation(selectedText).then(explanation => {
                            showModal(explanation);
                        }).catch(error => console.error('Error fetching explanation:', error));
                    });
                    // Add hover effect with animation
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
                    console.log('Received explanation:', response.explanation); // Debugging
                    resolve(response.explanation);
                } else {
                    console.error('Explanation fetching failed:', response);
                    reject('Failed to fetch explanation');
                }
            }
        );
    });
}

function showModal(text) {
    const modal = document.getElementById('explanationModal');
    const explanationText = document.getElementById('explanationText');
    explanationText.innerText = text;
    modal.style.display = 'block';
}

function hideModal() {
    const modal = document.getElementById('explanationModal');
    modal.style.display = 'none';
}

// Ensure the modal close buttons are functional
elementReady('.close').then((closeButton) => {
    closeButton.onclick = function() {
        hideModal();
    }
});

window.onclick = function(event) {
    const modal = document.getElementById('explanationModal');
    if (event.target == modal) {
        hideModal();
    }
}

// Ensure the main functionality runs after the body is ready
elementReady('body').then(function (body) {
    const contentElement = getMainContent();
    const text = contentElement.innerText;
    console.log('Extracting keywords from:', text); 
    extractKeywordsFromAPI(text).then(keywords => {
        highlightKeywords(keywords);
    }).catch(error => console.error('Error:', error));
});

document.addEventListener('mousedown', () => {
    hideModal();
});


