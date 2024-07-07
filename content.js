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

        if (opts.timeout) {
            _timeout = setTimeout(() => {
                const error = new Error(`elementReady(${getter}) timed out at ${opts.timeout}ms`);
                reject(error);
            }, opts.timeout);
        }

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
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        document.body.innerHTML = document.body.innerHTML.replace(regex, `<span class="highlight">${keyword}</span>`);
    });
}

function fetchExplanationFromAPI(keyword) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'fetchExplanation', keyword: keyword },
            response => {
                if (response && response.explanation) {
                    resolve(response.explanation);
                } else {
                    console.error('Explanation fetch failed:', response);
                    reject('Failed to fetch explanation');
                }
            }
        );
    });
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

elementReady('body').then(function (body) {
    const text = document.body.innerText;
    console.log('Extracting keywords from:', text); 
    extractKeywordsFromAPI(text).then(keywords => {
        highlightKeywords(keywords);
    }).catch(error => console.error('Error:', error));
});

document.addEventListener('mouseup', async (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        const explanation = await fetchExplanationFromAPI(selectedText);
        showTooltip(explanation, event.pageX, event.pageY);
    }
});

document.addEventListener('mousedown', () => {
    hideTooltip();
});
