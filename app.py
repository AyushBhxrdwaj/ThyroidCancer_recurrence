from flask import Flask, request, jsonify
import joblib
import numpy as np
import pandas as pd
import os
import re
import math
from dotenv import load_dotenv
from google import genai
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib.colors import HexColor, white, Color
from datetime import datetime
from flask import send_file
from flask_cors import CORS

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))




app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'models')
DATA_PATH = os.path.join(BASE_DIR, 'data.csv')
REPORT_PATH = os.path.join(BASE_DIR, 'prediction_report.pdf')

# Load model and scaler
model = joblib.load(os.path.join(MODEL_DIR, 'random_forest_model.pkl'))
scaler = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))

# Load training columns
model_columns = joblib.load(os.path.join(MODEL_DIR, 'model_columns.pkl'))

feature_importance = joblib.load(os.path.join(MODEL_DIR, 'feature_importances.pkl'))
historical_data = pd.read_csv(DATA_PATH)

GENDER_MAP = {'Male': 'M', 'Female': 'F'}
SIMILARITY_WEIGHTS = {
    'Age': 50.0,
    'Gender': 25.0,
    'Risk': 25.0,
    'Smoking': 10.0,
    'Hx Smoking': 10.0,
    'Hx Radiothreapy': 10.0,
    'Thyroid Function': 10.0,
    'Physical Examination': 10.0,
    'Adenopathy': 10.0,
    'Pathology': 10.0,
    'Focality': 10.0,
    'T': 8.0,
    'N': 8.0,
    'M': 8.0,
    'Stage': 8.0,
    'Response': 8.0,
}




def _rounded_rect(c, x, y, w, h, r, fill_color=None, stroke_color=None, stroke_width=0):
    """Draw a rounded rectangle on the canvas."""
    p = c.beginPath()
    p.moveTo(x + r, y)
    p.lineTo(x + w - r, y)
    p.arcTo(x + w - r, y, x + w, y + r, 0)
    p.lineTo(x + w, y + h - r)
    p.arcTo(x + w, y + h - r, x + w - r, y + h, 0)
    p.lineTo(x + r, y + h)
    p.arcTo(x + r, y + h, x, y + h - r, 0)
    p.lineTo(x, y + r)
    p.arcTo(x, y + r, x + r, y, 0)
    p.close()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    c.drawPath(p, fill=1 if fill_color else 0, stroke=1 if stroke_color else 0)


def _draw_separator(c, x, y, w, color):
    """Draw a subtle gradient-like horizontal line."""
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    c.line(x, y, x + w, y)


def _wrap_text(text, max_chars=88):
    """Word-wrap text to fit within a character limit."""
    words = text.split()
    lines, current = [], ""
    for w in words:
        if len(current) + len(w) + 1 <= max_chars:
            current = current + " " + w if current else w
        else:
            lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def _generate_gemini_text(prompt):
    response = client.models.generate_content(
        model='gemini-3-flash-preview',
        contents=prompt,
    )
    return (response.text or "").strip()


def _coerce_number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_python(value):
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        float_value = float(value)
        return int(float_value) if float_value.is_integer() else float_value
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if hasattr(value, 'item'):
        extracted = value.item()
        return _to_python(extracted)
    return value


def _display_gender(value):
    normalized = str(value).strip().lower()
    if normalized in {'m', 'male'}:
        return 'Male'
    if normalized in {'f', 'female'}:
        return 'Female'
    return _to_python(value)


def _canonical_gender(value):
    normalized = str(value).strip().lower()
    if normalized in {'m', 'male'}:
        return 'M'
    if normalized in {'f', 'female'}:
        return 'F'
    return str(value).strip()


def _clean_input_data(raw_input_data):
    patient_data = dict(raw_input_data or {})
    input_data = dict(patient_data)

    if 'Gender' in input_data and input_data['Gender'] in GENDER_MAP:
        input_data['Gender'] = GENDER_MAP[input_data['Gender']]

    return patient_data, input_data


def _build_model_payload(raw_input_data):
    patient_data, input_data = _clean_input_data(raw_input_data)
    input_df = pd.DataFrame([input_data])
    input_df = pd.get_dummies(input_df)
    input_df = input_df.reindex(columns=model_columns, fill_value=0)
    input_scaled = scaler.transform(input_df)
    return patient_data, input_data, input_df, input_scaled


def _predict_case(raw_input_data):
    patient_data, input_data, input_df, input_scaled = _build_model_payload(raw_input_data)
    prediction = int(model.predict(input_scaled)[0])
    probability = float(model.predict_proba(input_scaled)[0][1] * 100)

    prediction_text = (
        f'Recurrence Likely with {probability:.2f}% confidence'
        if prediction == 1
        else f'Recurrence Unlikely with {100 - probability:.2f}% confidence'
    )

    return {
        'patient_data': patient_data,
        'input_data': input_data,
        'input_df': input_df,
        'input_scaled': input_scaled,
        'prediction': prediction,
        'confidence': round(probability, 2),
        'prediction_text': prediction_text,
        'risk_label': 'high' if prediction == 1 else 'low',
    }


def _build_changes(original_data, scenario_data):
    changes = []
    combined_keys = sorted(set(original_data.keys()) | set(scenario_data.keys()))

    for key in combined_keys:
        original_value = original_data.get(key)
        scenario_value = scenario_data.get(key)

        if str(original_value) == str(scenario_value):
            continue

        changes.append(
            {
                'field': key,
                'from': _to_python(original_value),
                'to': _to_python(scenario_value),
            }
        )

    return changes


def _score_similarity(row, target_data):
    score = 0.0
    possible = 0.0
    reasons = []

    target_age = _coerce_number(target_data.get('Age'))
    row_age = _coerce_number(row.get('Age'))
    if target_age is not None and row_age is not None:
        possible += SIMILARITY_WEIGHTS['Age']
        age_diff = abs(row_age - target_age)
        age_score = max(0.0, SIMILARITY_WEIGHTS['Age'] * (1 - min(age_diff, 20) / 20))
        score += age_score
        if age_diff == 0:
            reasons.append('Exact age match')
        elif age_diff <= 5:
            reasons.append('Age is very close')
        elif age_diff <= 10:
            reasons.append('Age is close')

    for field, weight in SIMILARITY_WEIGHTS.items():
        if field == 'Age':
            continue

        target_value = target_data.get(field)
        row_value = row.get(field)
        if target_value in (None, '') or pd.isna(row_value):
            continue

        possible += weight
        if field == 'Gender':
            target_value = _canonical_gender(target_value)
            row_value = _canonical_gender(row_value)
        else:
            target_value = str(target_value).strip().lower()
            row_value = str(row_value).strip().lower()

        if row_value == target_value:
            score += weight
            reasons.append(f'Same {field.lower()}')

    if possible == 0:
        return 0.0, ['No comparable fields available']

    normalized = round((score / possible) * 100, 1)
    if not reasons:
        reasons.append('Closest available historical profile')
    return normalized, reasons[:3]


def _build_similar_cases(target_data, limit=3):
    if historical_data.empty:
        return []

    cases = []
    for _, row in historical_data.iterrows():
        match_score, reasons = _score_similarity(row, target_data)
        if match_score <= 0:
            continue

        age = _to_python(row.get('Age'))
        gender = _display_gender(row.get('Gender'))
        risk = _to_python(row.get('Risk'))
        recurred_value = str(row.get('Recurred', '')).strip().lower()
        if recurred_value == 'yes':
            outcome_label = 'Recurrence observed'
        elif recurred_value == 'no':
            outcome_label = 'No recurrence observed'
        else:
            outcome_label = _to_python(row.get('Recurred')) or 'Unknown outcome'

        cases.append(
            {
                'Age': age,
                'Gender': gender,
                'Risk': risk,
                'Stage': _to_python(row.get('Stage')),
                'Response': _to_python(row.get('Response')),
                'Recurred': _to_python(row.get('Recurred')),
                'match_score': match_score,
                'match_reasons': reasons,
                'outcome_label': outcome_label,
                'summary': f"{age} year old {gender} patient with {risk} risk",
            }
        )

    cases.sort(key=lambda item: item['match_score'], reverse=True)
    return cases[:limit]


def _summarize_scenario(base_data, scenario_data):
    changes = _build_changes(base_data, scenario_data)
    if not changes:
        return 'The scenario keeps the report inputs unchanged.'

    changed_fields = ', '.join(change['field'] for change in changes)
    return f"The scenario changes: {changed_fields}."


def create_pdf(patient_data, prediction, explanation):

    file_path = REPORT_PATH
    c = pdf_canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    # ──────────────── Color Palette ────────────────
    bg          = HexColor("#0B0F19")
    card_bg     = HexColor("#131825")
    card_border = HexColor("#1E2640")
    accent_blue = HexColor("#3B82F6")
    accent_teal = HexColor("#06B6D4")
    success     = HexColor("#22C55E")
    danger      = HexColor("#EF4444")
    muted       = HexColor("#64748B")
    text_primary   = HexColor("#F1F5F9")
    text_secondary = HexColor("#94A3B8")
    bar_track   = HexColor("#1E293B")
    gold        = HexColor("#F59E0B")

    MARGIN = 44
    CARD_PAD = 18
    content_w = width - 2 * MARGIN

    # ──────────────── Full-page Background ────────────────
    c.setFillColor(bg)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Subtle top accent bar
    c.setFillColor(accent_blue)
    c.rect(0, height - 6, width, 6, fill=1, stroke=0)

    y = height - 52

    # ══════════════════════════════════════════════════
    # HEADER
    # ══════════════════════════════════════════════════
    # Icon circle
    c.setFillColor(accent_blue)
    icon_cx, icon_cy, icon_r = MARGIN + 14, y - 2, 14
    c.circle(icon_cx, icon_cy, icon_r, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(icon_cx, icon_cy - 5, "T")

    c.setFillColor(text_primary)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(MARGIN + 36, y, "Thyroid Cancer Recurrence Report")

    c.setFillColor(text_secondary)
    c.setFont("Helvetica", 9)
    date_str = datetime.now().strftime("%B %d, %Y  •  %I:%M %p")
    c.drawString(MARGIN + 36, y - 16, f"AI-Generated Clinical Analysis  |  {date_str}")

    y -= 52

    # ══════════════════════════════════════════════════
    # PREDICTION RESULT CARD
    # ══════════════════════════════════════════════════
    is_positive = "Likely" in prediction and "Unlikely" not in prediction
    badge_color = danger if is_positive else success
    badge_label = "HIGH RISK" if is_positive else "LOW RISK"

    match = re.search(r"(\d+\.?\d*)%", prediction)
    conf = float(match.group(1)) if match else 50.0

    pred_card_h = 95
    _rounded_rect(c, MARGIN, y - pred_card_h, content_w, pred_card_h,
                  r=10, fill_color=card_bg, stroke_color=card_border, stroke_width=0.6)

    # Left color accent stripe
    c.setFillColor(badge_color)
    c.rect(MARGIN, y - pred_card_h + 10, 4, pred_card_h - 20, fill=1, stroke=0)

    # Section label
    c.setFillColor(text_secondary)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN + CARD_PAD + 6, y - 16, "PREDICTION RESULT")

    # Badge pill
    badge_w = 80
    badge_h = 20
    badge_x = MARGIN + CARD_PAD + 6
    badge_y = y - 42
    _rounded_rect(c, badge_x, badge_y, badge_w, badge_h, r=10, fill_color=badge_color)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(badge_x + badge_w / 2, badge_y + 6, badge_label)

    # Prediction text
    c.setFillColor(text_primary)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(badge_x + badge_w + 14, badge_y + 4, prediction)

    # Confidence bar
    bar_x = MARGIN + CARD_PAD + 6
    bar_y_pos = y - pred_card_h + 18
    bar_w = content_w - 2 * CARD_PAD - 12
    bar_h = 10

    c.setFillColor(text_secondary)
    c.setFont("Helvetica", 8)
    c.drawString(bar_x, bar_y_pos + 14, f"AI Confidence")
    c.drawRightString(bar_x + bar_w, bar_y_pos + 14, f"{conf:.1f}%")

    _rounded_rect(c, bar_x, bar_y_pos, bar_w, bar_h, r=5, fill_color=bar_track)
    filled_w = max(bar_w * (conf / 100), 10)
    _rounded_rect(c, bar_x, bar_y_pos, filled_w, bar_h, r=5, fill_color=accent_blue)

    y -= pred_card_h + 14

    # ══════════════════════════════════════════════════
    # PATIENT INFORMATION CARD
    # ══════════════════════════════════════════════════
    items = list(patient_data.items())
    cols = 3
    row_h = 18
    rows = math.ceil(len(items) / cols)
    patient_card_h = 36 + rows * row_h + 10

    _rounded_rect(c, MARGIN, y - patient_card_h, content_w, patient_card_h,
                  r=10, fill_color=card_bg, stroke_color=card_border, stroke_width=0.6)

    c.setFillColor(text_secondary)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN + CARD_PAD, y - 16, "PATIENT INFORMATION")
    _draw_separator(c, MARGIN + CARD_PAD, y - 24, content_w - 2 * CARD_PAD, card_border)

    col_w = (content_w - 2 * CARD_PAD) / cols
    for idx, (key, value) in enumerate(items):
        col_idx = idx % cols
        row_idx = idx // cols
        cx = MARGIN + CARD_PAD + col_idx * col_w
        cy = y - 38 - row_idx * row_h

        # Key label
        c.setFillColor(muted)
        c.setFont("Helvetica", 7.5)
        display_key = key.replace("_", " ").title()
        c.drawString(cx, cy, display_key)

        # Value
        c.setFillColor(text_primary)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(cx, cy - 10, str(value))

    y -= patient_card_h + 14

    # ══════════════════════════════════════════════════
    # AI EXPLANATION CARD  (dynamic height, multi-page)
    # ══════════════════════════════════════════════════
    # Pre-process explanation into styled lines
    styled_lines = []  # list of (text, font, size, color, indent)
    section_num = 0
    for paragraph in explanation.split("\n"):
        stripped = paragraph.strip()
        if not stripped:
            styled_lines.append(("", "Helvetica", 9.5, text_secondary, 0))
            continue

        # Detect section headers
        is_header = (
            stripped.isupper()
            or stripped.lower().startswith("what this means")
            or stripped.lower().startswith("key factors")
            or stripped.lower().startswith("what you can do")
        )

        if is_header:
            section_num += 1
            colors = [accent_blue, accent_teal, gold]
            hdr_color = colors[(section_num - 1) % len(colors)]
            styled_lines.append(("", "Helvetica", 6, text_secondary, 0))  # spacing
            styled_lines.append((stripped, "Helvetica-Bold", 10.5, hdr_color, 0))
            continue

        # Bullet points
        if stripped.startswith("- ") or stripped.startswith("• "):
            bullet_text = stripped.lstrip("-•").strip()
            for i, wl in enumerate(_wrap_text(bullet_text, 82)):
                prefix = "  •  " if i == 0 else "      "
                styled_lines.append((prefix + wl, "Helvetica", 9.5, text_primary, 8))
            continue

        # Normal text
        for wl in _wrap_text(stripped, 88):
            styled_lines.append((wl, "Helvetica", 9.5, text_primary, 0))

    line_height = 14
    available_h = y - 80  # leave room for footer
    total_lines_h = len(styled_lines) * line_height + 40
    explanation_card_h = min(total_lines_h, available_h)

    _rounded_rect(c, MARGIN, y - explanation_card_h, content_w, explanation_card_h,
                  r=10, fill_color=card_bg, stroke_color=card_border, stroke_width=0.6)

    # Section label with icon
    c.setFillColor(accent_blue)
    c.circle(MARGIN + CARD_PAD + 6, y - 15, 6, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(MARGIN + CARD_PAD + 6, y - 18, "✦")

    c.setFillColor(text_secondary)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN + CARD_PAD + 18, y - 18, "AI-POWERED ANALYSIS")
    _draw_separator(c, MARGIN + CARD_PAD, y - 26, content_w - 2 * CARD_PAD, card_border)

    ty = y - 42
    bottom_limit = y - explanation_card_h + 12

    for (line_text, font, size, color, indent) in styled_lines:
        if ty < bottom_limit:
            # Start a new page
            c.showPage()
            c.setFillColor(bg)
            c.rect(0, 0, width, height, fill=1, stroke=0)
            ty = height - MARGIN - 10

            # Continuation card
            remaining_idx = styled_lines.index((line_text, font, size, color, indent))
            remaining = len(styled_lines) - remaining_idx
            cont_h = min(remaining * line_height + 40, height - 2 * MARGIN - 40)
            _rounded_rect(c, MARGIN, ty - cont_h, content_w, cont_h,
                          r=10, fill_color=card_bg, stroke_color=card_border, stroke_width=0.6)

            c.setFillColor(text_secondary)
            c.setFont("Helvetica", 8)
            c.drawString(MARGIN + CARD_PAD, ty - 8, "AI-POWERED ANALYSIS (continued)")
            _draw_separator(c, MARGIN + CARD_PAD, ty - 14, content_w - 2 * CARD_PAD, card_border)
            ty -= 28
            bottom_limit = ty - cont_h + 30

        c.setFillColor(color)
        c.setFont(font, size)
        c.drawString(MARGIN + CARD_PAD + indent, ty, line_text)
        ty -= line_height

    # ══════════════════════════════════════════════════
    # FOOTER
    # ══════════════════════════════════════════════════
    _draw_separator(c, MARGIN, 52, content_w, HexColor("#1E293B"))

    c.setFillColor(muted)
    c.setFont("Helvetica", 7)
    c.drawString(MARGIN, 40,
        "This report is generated by an AI model and is intended for informational purposes only. "
        "It does not constitute medical advice.")
    c.setFillColor(text_secondary)
    c.setFont("Helvetica", 7)
    c.drawRightString(width - MARGIN, 40, f"Report ID: THY-{datetime.now().strftime('%Y%m%d%H%M%S')}")

    c.save()
    return file_path


@app.route('/api/predict', methods=['POST'])
def api_predict():
    try:
        raw_input_data = request.get_json(silent=True) or {}
        prediction_result = _predict_case(raw_input_data)
        patient_data = prediction_result['patient_data']
        prediction = prediction_result['prediction']
        probability = prediction_result['confidence']

        top_features = [
            f.replace(' ', '_') for f in feature_importance.head(5).index.tolist()
        ]

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

        explanation = _generate_gemini_text(prompt)

        result = prediction_result['prediction_text']

        pdf_path = create_pdf(patient_data, result, explanation)

        return jsonify({
            'prediction_text': result,
            'explanation': explanation,
            'patient_data': patient_data,
            'confidence': round(probability, 2),
            'risk_label': 'high' if prediction == 1 else 'low',
            'top_features': top_features,
        })

    except Exception as e:
        return jsonify({'error': 'Something went wrong: ' + str(e)}), 500


@app.route('/api/simulate_risk', methods=['POST'])
def simulate_risk():
    try:
        payload = request.get_json(silent=True) or {}
        base_patient_data = dict(
            payload.get('patient_data')
            or (payload.get('report_context') or {}).get('patient_data')
            or {}
        )
        scenario_updates = dict(payload.get('scenario') or payload.get('changes') or {})

        if not base_patient_data:
            return jsonify({'error': 'Patient data is required'}), 400

        scenario_data = dict(base_patient_data)
        for key, value in scenario_updates.items():
            if value in (None, ''):
                continue
            scenario_data[key] = value

        baseline = _predict_case(base_patient_data)
        scenario = _predict_case(scenario_data)
        confidence_delta = round(float(scenario['confidence']) - float(baseline['confidence']), 2)

        if confidence_delta > 0:
            direction = 'increased'
            insight = (
                f"The scenario raises the model's recurrence probability by {confidence_delta:.1f} points compared with the current report."
            )
        elif confidence_delta < 0:
            direction = 'decreased'
            insight = (
                f"The scenario lowers the model's recurrence probability by {abs(confidence_delta):.1f} points compared with the current report."
            )
        else:
            direction = 'unchanged'
            insight = "The scenario does not change the model's recurrence probability."

        similar_cases = _build_similar_cases(scenario_data)
        if similar_cases:
            top_match = similar_cases[0]
            insight += (
                f" The closest historical case is a {top_match['match_score']:.1f}% match and ended with {top_match['outcome_label'].lower()}."
            )

        return jsonify(
            {
                'baseline': {
                    'prediction_text': baseline['prediction_text'],
                    'confidence': baseline['confidence'],
                    'risk_label': baseline['risk_label'],
                    'patient_data': baseline['patient_data'],
                },
                'scenario': {
                    'prediction_text': scenario['prediction_text'],
                    'confidence': scenario['confidence'],
                    'risk_label': scenario['risk_label'],
                    'patient_data': scenario_data,
                },
                'confidence_delta': confidence_delta,
                'risk_direction': direction,
                'changes': _build_changes(base_patient_data, scenario_data),
                'similar_cases': similar_cases,
                'insight': insight,
                'summary': _summarize_scenario(base_patient_data, scenario_data),
            }
        )

    except Exception as e:
        return jsonify({'error': 'Something went wrong: ' + str(e)}), 500


@app.route('/api/report_chat', methods=['POST'])
def report_chat():
    try:
        payload = request.get_json(silent=True) or {}
        question = (payload.get('question') or '').strip()

        if not question:
            return jsonify({'error': 'Question is required'}), 400

        report_context = payload.get('report_context') or {}
        messages = payload.get('messages') or []

        patient_data = report_context.get('patient_data') or {}
        patient_lines = (
            "\n".join(f"- {key}: {value}" for key, value in patient_data.items())
            if patient_data
            else "- Not provided"
        )

        top_features = report_context.get('top_features') or []
        feature_lines = ", ".join(str(feature) for feature in top_features) if top_features else "Not provided"

        conversation_lines = []
        for message in messages[-10:]:
            content = str(message.get('content', '')).strip()
            if not content:
                continue
            role = str(message.get('role', 'user')).strip() or 'user'
            conversation_lines.append(f"{role.title()}: {content}")

        conversation_history = "\n".join(conversation_lines) if conversation_lines else "None"

        prompt = f"""You are a careful, compassionate chatbot inside a thyroid cancer recurrence report.
Your job is to answer questions about this report only, using only the provided context.

Report context:
- Prediction: {report_context.get('prediction_text') or 'Not provided'}
- Confidence: {report_context.get('confidence') if report_context.get('confidence') is not None else 'Not provided'}
- Risk label: {report_context.get('risk_label') or 'Not provided'}
- Patient data:
{patient_lines}
- Key factors: {feature_lines}
- Report explanation:
{report_context.get('explanation') or 'Not provided'}

Conversation history:
{conversation_history}

User question:
{question}

Rules:
- Use only the report context above. Do not invent facts.
- If the user asks something not contained in the report, say that you cannot confirm it from the report and suggest speaking with a clinician.
- Explain medical ideas in plain language.
- Be concise, supportive, and practical.
- Do not give a diagnosis or replace professional medical advice.
- Do not use markdown headings.
"""

        answer = _generate_gemini_text(prompt)
        if not answer:
            answer = 'I could not generate a response right now. Please try again.'

        return jsonify({'answer': answer})

    except Exception as e:
        return jsonify({'error': 'Something went wrong: ' + str(e)}), 500


@app.route('/api/download_report')
def download_report():
    return send_file(REPORT_PATH, as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True)