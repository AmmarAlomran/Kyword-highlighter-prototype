# # keyllm_script.py
# from keybert import KeyBERT
# from flask import Flask, request, jsonify
# from flask_cors import CORS

# app = Flask(__name__)
# CORS(app)

# kw_model = KeyBERT()

# @app.route('/extract_keywords', methods=['POST'])
# def extract_keywords():
#     data = request.get_json()
#     text = data.get('text')
#     keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english')
#     keywords = [kw[0] for kw in keywords]
#     return jsonify(keywords=keywords)

# if __name__ == '__main__':
#     app.run(debug=True)

from flask import Flask, request, jsonify
import tensorflow as tf
from keybert import KeyBERT


app = Flask(__name__)

kw_model = KeyBERT()

@app.route('/extract_keywords', methods=['POST'])
def extract_keywords_route():
    data = request.json
    text = data.get('text', '')
    if text:
        keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english')
        keywords = [kw[0] for kw in keywords]
        return jsonify({'keywords': keywords})
    else:
        return jsonify({'error': 'No text provided'}), 400

if __name__ == '__main__':
    app.run(debug=True)
