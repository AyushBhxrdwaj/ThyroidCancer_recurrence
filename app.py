from flask import Flask, render_template, request
import joblib
import numpy as np
import pandas as pd
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))




app = Flask(__name__)

# Load model and scaler
model = joblib.load('models/random_forest_model.pkl')
scaler = joblib.load('models/scaler.pkl')

# Load training columns (IMPORTANT)
model_columns = joblib.load('models/model_columns.pkl')

feature_importance = joblib.load('models/feature_importances.pkl')






@app.route("/")
def home():
    return render_template('index.html')


@app.route('/report', methods=['POST'])
def report():
    try:
        # Get input data from form
        input_data = request.form.to_dict()

        # Convert to DataFrame
        input_df = pd.DataFrame([input_data])

        # Apply one-hot encoding
        input_df = pd.get_dummies(input_df)

        # Match training columns
        input_df = input_df.reindex(columns=model_columns, fill_value=0)

        # Apply scaling
        input_scaled = scaler.transform(input_df)

        # Prediction
        prediction = model.predict(input_scaled)[0]

        top_features = [
    f.replace(' ', '_') for f in feature_importance.head(5).index.tolist()
]

        probability = model.predict_proba(input_scaled)[0][1] * 100

        prompt = f"""You are a compassionate medical AI assistant explaining thyroid cancer recurrence predictions to patients.

Patient prediction: {"Recurrence Likely" if prediction == 1 else "Recurrence Unlikely"}
Confidence: {probability:.1f}%
Key factors considered: {", ".join(top_features)}

Write a clear, warm, and easy-to-understand explanation for the patient. Follow these rules strictly:
- Do NOT use any technical codes, variable names, column names, or abbreviations like N1b, T1a, M0, etc.
- Translate all medical terms into plain everyday language.
- Structure your response into exactly 3 short sections using these exact headings:
  1. "What This Means" — a 2-3 sentence summary of the result.
  2. "Key Factors" — briefly explain the top contributing factors in simple words (use bullet points, max 4 bullets).
  3. "What You Can Do" — give 3-4 actionable health tips as bullet points.
- Keep the entire response under 200 words.
- Use a reassuring and supportive tone throughout.
- Do NOT use markdown formatting like ### or ** or *. Use plain text only."""
        
        response = client.models.generate_content(
    model = 'gemini-3-flash-preview',
    contents=prompt
)
        explanation = response.text

        result = f"Recurrence Likely with {probability:.2f}% confidence" if prediction == 1 else f"Recurrence Unlikely with {100 - probability:.2f}% confidence"

        return render_template('index.html', prediction_text=result, explanation=explanation)

    except Exception as e:
        return render_template('index.html',
                               prediction_text="Error: " + str(e))


if __name__ == "__main__":
    app.run(debug=True)