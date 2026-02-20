from flask import Flask, render_template, request
import joblib
import numpy as np
import pandas as pd

app = Flask(__name__)

# Load model and scaler
model = joblib.load('models/random_forest_model.pkl')
scaler = joblib.load('models/scaler.pkl')

# Load training columns (IMPORTANT)
model_columns = joblib.load('models/model_columns.pkl')


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

        probability = model.predict_proba(input_scaled)[0][1] * 100

        result = f"Recurrence Likely with {probability:.2f}% confidence" if prediction == 1 else f"Recurrence Unlikely with {100 - probability:.2f}% confidence"

        return render_template('index.html', prediction_text=result)

    except Exception as e:
        return render_template('index.html',
                               prediction_text="Error: " + str(e))


if __name__ == "__main__":
    app.run(debug=True)