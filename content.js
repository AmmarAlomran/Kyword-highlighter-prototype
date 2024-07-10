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
        // Check if the node or its ancestors have any of these classes or tags
        const excludeClasses = ['CodeHighlight', 'code', 'pre'];
        const excludeTags = ['SCRIPT', 'STYLE', 'PRE', 'CODE', 'BUTTON', 'INPUT', 'TEXTAREA'];
        
        let current = node;
        while (current && current !== document.body) {
            if (excludeTags.includes(current.nodeName)) return false;
            if (current.classList && excludeClasses.some(cls => current.classList.contains(cls))) return false;
            current = current.parentElement;
        }
        return true;
    }

    function traverseNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (shouldHighlight(node) && node.textContent.match(regex)) {
                const span = document.createElement('span');
                span.innerHTML = node.textContent.replace(regex, match => `<span class="highlight">${match}</span>`);
                node.parentNode.replaceChild(span, node);
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


async function fetchExplanation(keyword) {
    try {
        const response = await fetch('http://127.0.0.1:5000/get_explanation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ keyword: keyword })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.explanation;
    } catch (error) {
        console.error('Error fetching explanation:', error);
        return 'Error fetching explanation.';
    }
}

function showTooltip(text, x, y) {
    let tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'white';
        tooltip.style.border = '1px solid black';
        tooltip.style.padding = '5px';
        tooltip.style.zIndex = 1000;
        document.body.appendChild(tooltip);
    }
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.innerText = text;
    tooltip.style.display = 'block';
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

function getMainContent() {
    // Adjust these selectors to match your page structure
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
    return false;
}

elementReady('body').then(function (body) {
    const contentElement = getMainContent();
    text = contentElement.innerText;
    console.log('Extracting keywords from:', text); 
    extractKeywordsFromAPI(text).then(keywords => {
        highlightKeywords(keywords, contentElement);
    }).catch(error => console.error('Error:', error));
});

document.addEventListener('mouseup', async (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        const explanation = await fetchExplanation(selectedText);
        showTooltip(explanation, event.pageX, event.pageY);
    }
});

document.addEventListener('mousedown', () => {
    hideTooltip();
});