from flask import Flask, request, jsonify
from keybert import KeyBERT
from rake_nltk import Rake
import yake
from collections import Counter
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

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

# def extract_keywords(text):
#     KeyBERT
#     kw_model = KeyBERT()
#     keybert_keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english')
#     keybert_keywords = [kw[0] for kw in keybert_keywords] 


nlp = spacy.load('en_core_web_sm')

# Initialize KeyBERT
kw_model = KeyBERT()

# # Custom function to identify terms
# def identify_terms(text):
#     doc = nlp(text)
#     terms = set()
    
#     # Using Named Entity Recognition (NER)
#     for ent in doc.ents:
#         terms.add(ent.text)
    
#     # Using Part-of-Speech (POS) tagging and Dependency Parsing
#     for token in doc:
#         if token.pos_ in ['PROPN', 'NOUN']:  # Proper nouns and nouns
#             terms.add(token.text)
    
#     # Using KeyBERT for keyword extraction with error handling
#     # try:
#     #     keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words=None)
#     #     for keyword in keywords:
#     #         terms.add(keyword[0])
#     # except Exception as e:
#     #     print(f"Keyword extraction failed: {e}")
    
#     print("Identified Terms:", terms)
    
#     return terms

def identify_terms(text):
    doc = nlp(text)
    terms = []
    
    # Using Named Entity Recognition (NER)
    for ent in doc.ents:
        terms.append(ent.text)
    
    # Using Part-of-Speech (POS) tagging and Dependency Parsing
    for token in doc:
        if token.pos_ in ['PROPN', 'NOUN']:  # Proper nouns and nouns
            terms.append(token.text)
            
    try:
        keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words=None)
        for keyword in keywords:
            terms.append(keyword[0])
    except Exception as e:
        print(f"Keyword extraction failed: {e}")
    
    return terms    

@app.route('/extract_keywords', methods=['POST'])
def extract_keywords_route():
    data = request.json
    text = data.get('text', '')
    if text:
        keywords = identify_terms(text)
        return jsonify({'keywords': keywords})
    else:
        return jsonify({'error': 'No text provided'}), 400


@app.route('/get_explanation', methods=['POST'])
def get_explanation_route():
    data = request.json
    keyword = data.get('keyword', '')
    if keyword:
        explanation = fetch_wikipedia_summary(keyword)
        return jsonify({'explanation': explanation})
    else:
        return jsonify({'error': 'No keyword provided'}), 400

if __name__ == '__main__':
    app.run(debug=True)
