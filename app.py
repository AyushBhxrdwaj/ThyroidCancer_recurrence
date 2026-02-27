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

# Load model and scaler
model = joblib.load('models/random_forest_model.pkl')
scaler = joblib.load('models/scaler.pkl')

# Load training columns
model_columns = joblib.load('models/model_columns.pkl')

feature_importance = joblib.load('models/feature_importances.pkl')




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


def create_pdf(patient_data, prediction, explanation):

    file_path = "prediction_report.pdf"
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

# ── JSON API for React frontend ──
@app.route('/api/predict', methods=['POST'])
def api_predict():
    try:
        input_data = request.get_json()

        # Map form values to match training data format
        gender_map = {'Male': 'M', 'Female': 'F'}
        if 'Gender' in input_data and input_data['Gender'] in gender_map:
            input_data['Gender'] = gender_map[input_data['Gender']]

        input_df = pd.DataFrame([input_data])
        input_df = pd.get_dummies(input_df)
        input_df = input_df.reindex(columns=model_columns, fill_value=0)

        # Apply scaling
        input_scaled = scaler.transform(input_df)

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
            model='gemini-3-flash-preview',
            contents=prompt
        )
        explanation = response.text

        result = (
            f"Recurrence Likely with {probability:.2f}% confidence"
            if prediction == 1
            else f"Recurrence Unlikely with {100 - probability:.2f}% confidence"
        )

        pdf_path = create_pdf(input_data, result, explanation)

        return jsonify({
            'prediction_text': result,
            'explanation': explanation,
        })

    except Exception as e:
        return jsonify({'error': 'Something went wrong: ' + str(e)}), 500


@app.route('/api/download_report')
def download_report():
    return send_file('prediction_report.pdf', as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True)