from flask import Flask, request, jsonify
from keybert import KeyBERT
from collections import Counter
import requests

app = Flask(__name__)

# # Download NLTK data (if not already done)
# nltk.download('punkt')

def fetch_wikipedia_summary(keyword):
    try:
        response = requests.get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{keyword}")
        if response.status_code == 200:
            data = response.json()
            return data.get("extract", f"No summary available for {keyword}")
        else:
            return f"No summary available for {keyword}"
    except Exception as e:
        return f"Error fetching summary for {keyword}: {str(e)}"


def extract_keywords(text):
    kw_model = KeyBERT()
    keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english')
    keywords = [kw[0] for kw in keywords]
    
    # Count the frequency of keywords and ensure uniqueness
    keyword_counts = Counter(keywords)
    extract_keywords = [word for word, _ in keyword_counts.most_common()]

    return extract_keywords


@app.route('/extract_keywords', methods=['POST'])
def extract_keywords_route():
    data = request.json
    text = data.get('text', '')
    if text:
        keywords = extract_keywords(text)
        print(keywords)
        return jsonify({'keywords': keywords})
    else:
        return jsonify({'error': 'No text provided'}), 400

if __name__ == '__main__':
    app.run(debug=True)
