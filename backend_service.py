from flask import Flask, request, jsonify
from keybert import KeyBERT
from transformers import pipeline
from flask_cors import CORS
import requests
from transformers import (
    TokenClassificationPipeline,
    AutoModelForTokenClassification,
    AutoTokenizer,
)
from transformers.pipelines import AggregationStrategy
import numpy as np

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

# # Load pre-trained transformer model for contextual keyword extraction
# nlp = pipeline('feature-extraction', model='bert-base-uncased', tokenizer='bert-base-uncased')

# def extract_contextual_keywords(text):
#     # Use KeyBERT with contextual embeddings
#     kw_model = KeyBERT(model=nlp)
#     keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english')
#     return [kw[0] for kw in keywords]
 


# Define keyphrase extraction pipeline
class KeyphraseExtractionPipeline(TokenClassificationPipeline):
    def __init__(self, model, *args, **kwargs):
        super().__init__(
            model=AutoModelForTokenClassification.from_pretrained(model),
            tokenizer=AutoTokenizer.from_pretrained(model),
            *args,
            **kwargs
        )

    def postprocess(self, all_outputs):
        results = super().postprocess(
            all_outputs=all_outputs,
            aggregation_strategy=AggregationStrategy.SIMPLE,
        )
        return np.unique([result.get("word").strip() for result in results])
    
# Load pipeline
model_name = "ml6team/keyphrase-extraction-kbir-inspec"
extractor = KeyphraseExtractionPipeline(model=model_name)


@app.route('/extract_keywords', methods=['POST'])
def extract_keywords_route():
    data = request.json
    text = data.get('text', '')
    if text:
        keywords = list(extractor(text))
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
