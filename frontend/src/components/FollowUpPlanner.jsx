import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Sparkles,
} from "lucide-react";

function formatConfidence(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Not available";
  }

  return `${value.toFixed(1)}%`;
}

function describeFeature(featureName) {
  const labels = {
    Age: "Age",
    Gender: "Gender",
    Risk: "Risk category",
    Smoking: "Smoking history",
    "Hx Smoking": "Past smoking history",
    "Hx Radiothreapy": "Previous radiotherapy history",
    "Thyroid Function": "Thyroid function",
    "Physical Examination": "Physical examination findings",
    Adenopathy: "Neck lymph node findings",
    Pathology: "Pathology findings",
    Focality: "Tumor focality",
    T: "Tumor stage",
    N: "Lymph node stage",
    M: "Spread stage",
    Stage: "Overall stage",
    Response: "Treatment response",
  };

  return labels[featureName] || featureName.replaceAll("_", " ");
}

function buildFollowUpPlan(reportContext = {}) {
  const patientData = reportContext.patient_data || {};
  const recurrenceProbability =
    typeof reportContext.confidence === "number"
      ? reportContext.confidence
      : null;
  const riskLabel = String(reportContext.risk_label || "").toLowerCase();
  const topFactors = Array.isArray(reportContext.top_features)
    ? reportContext.top_features
    : [];
  const age = Number(patientData.Age);
  const hasAge = Number.isFinite(age);

  const riskBand =
    riskLabel === "high" ||
    (recurrenceProbability !== null && recurrenceProbability >= 70)
      ? "high"
      : recurrenceProbability !== null && recurrenceProbability >= 50
        ? "moderate"
        : "low";

  const reviewWindow =
    riskBand === "high"
      ? "Review within 1-3 months"
      : riskBand === "moderate"
        ? "Review within 3-6 months"
        : "Review within 6-12 months";

  const priority =
    riskBand === "high"
      ? "High priority"
      : riskBand === "moderate"
        ? "Moderate priority"
        : "Routine priority";

  const summary =
    riskBand === "high"
      ? "The current report suggests closer follow-up and a clear discussion with the care team about the next review step."
      : riskBand === "moderate"
        ? "The current report suggests a steady follow-up plan with a timely review of what could change monitoring needs."
        : "The current report suggests routine follow-up, while still keeping a clear plan for symptoms or changes that should prompt earlier review.";

  const keyDiscussionPoints = [
    riskBand === "high"
      ? "Ask whether your next review should be sooner than the usual schedule."
      : riskBand === "moderate"
        ? "Ask what findings would move you into a closer monitoring plan."
        : "Ask what the usual follow-up timeline looks like for your current result.",
    hasAge && age >= 60
      ? "Because age can affect planning, ask whether the follow-up frequency should be adjusted."
      : "Ask whether age changes anything about the follow-up plan.",
    recurrenceProbability !== null
      ? `The model estimates recurrence probability at ${recurrenceProbability.toFixed(1)}%, so ask how certain the result is and how that should shape the next visit.`
      : "Ask how confident the report is and how that should affect the plan.",
  ];

  const homeActions =
    riskBand === "high"
      ? [
          "Keep a note of any new or worsening symptoms so you can share them quickly.",
          "Bring the report to your next appointment and ask for the next step in writing.",
          "Do not delay contact if something feels different or concerning.",
        ]
      : riskBand === "moderate"
        ? [
            "Track any changes in symptoms and bring them to the next review.",
            "Keep your follow-up appointments on time so changes can be caught early.",
            "Ask the clinician what would count as a reason to return sooner.",
          ]
        : [
            "Stay on the usual follow-up schedule and keep a reminder for the next review.",
            "Write down any changes you notice so you can mention them at the appointment.",
            "Ask which symptoms or results should trigger an earlier visit.",
          ];

  const warningSigns = [
    "A new lump, swelling, or neck change that was not there before.",
    "Trouble swallowing, breathing, or persistent voice changes.",
    "A symptom that is getting worse instead of settling.",
  ];

  const questionsToAsk = [
    "When should my next review happen based on this report?",
    "Which symptoms should make me contact the clinic earlier?",
    "Do any of the main factors in my report change the follow-up schedule?",
  ];

  const modelFactors = topFactors.length
    ? topFactors.slice(0, 4).map(describeFeature)
    : ["Age", "Gender", "Risk category"];

  return {
    riskBand,
    priority,
    reviewWindow,
    summary,
    keyDiscussionPoints,
    homeActions,
    warningSigns,
    questionsToAsk,
    modelFactors,
  };
}

function SectionCard({ title, icon: Icon, items, tone = "neutral" }) {
  const toneClasses = {
    neutral: "border-white/10 bg-white/3 text-text-secondary",
    accent: "border-accent/20 bg-accent/10 text-text-secondary",
    danger: "border-danger/20 bg-danger/10 text-text-secondary",
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
        <Icon size={14} className="shrink-0" />
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li
            key={`${title}-${index}`}
            className="flex items-start gap-2 text-[0.84rem] leading-relaxed text-text-secondary"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="wrap-break-word">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[0.72rem] text-text-secondary">
      <span className="uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <span className="ml-2 font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function RiskBadge({ riskBand }) {
  const classes =
    riskBand === "high"
      ? "border-danger/20 bg-danger/10 text-danger"
      : riskBand === "moderate"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
        : "border-success/20 bg-success/10 text-success";

  const label =
    riskBand === "high"
      ? "Closer follow-up suggested"
      : riskBand === "moderate"
        ? "Moderate follow-up suggested"
        : "Routine follow-up suggested";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] ${classes}`}
    >
      {label}
    </span>
  );
}

export default function FollowUpPlanner({
  reportContext = {},
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const plan = buildFollowUpPlan(reportContext);
  const recurrenceProbability =
    typeof reportContext.confidence === "number"
      ? reportContext.confidence
      : null;
  const predictionText =
    reportContext.prediction_text || "Prediction unavailable";

  return (
    <div className="bg-card border border-card-border rounded-[20px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-3 border-b border-card-border bg-accent/3 px-6 py-5">
        <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[10px] bg-accent-glow text-accent">
          <CalendarDays size={18} />
        </div>
        <div>
          <h3 className="text-[0.95rem] font-bold text-text-primary">
            Personalized Follow-Up Planner
          </h3>
          <p className="text-[0.76rem] text-text-muted mt-0.5">
            A patient-friendly review plan based on the current prediction.
          </p>
        </div>
      </div>

      <div className="px-6 pt-4 text-[0.82rem] leading-relaxed text-text-muted">
        This plan is a discussion aid, not a diagnosis. Use it to prepare for
        your next appointment or to understand what the report is suggesting.
      </div>

      <div className="p-6 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/3 p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
              <Sparkles size={14} />
              Plan snapshot
            </div>
            <p className="wrap-break-word text-[0.9rem] leading-relaxed text-text-secondary">
              {predictionText} {plan.summary}
            </p>
            <div className="flex flex-wrap gap-2">
              <SummaryPill label="Priority" value={plan.priority} />
              <SummaryPill label="Review" value={plan.reviewWindow} />
              <SummaryPill
                label="Recurrence probability"
                value={formatConfidence(recurrenceProbability)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-4 py-2.5 text-[0.85rem] font-semibold text-text-primary transition-all duration-300 hover:border-accent/40 hover:bg-white/3 hover:text-white"
            aria-expanded={open}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {open ? "Hide follow-up plan" : "Open follow-up plan"}
          </button>
        </div>

        {open && (
          <div className="space-y-4 animate-target animate-in">
            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard
                title="Key discussion points"
                icon={ClipboardList}
                items={plan.keyDiscussionPoints}
                tone="accent"
              />
              <SectionCard
                title="What to do at home"
                icon={CheckCircle}
                items={plan.homeActions}
                tone="neutral"
              />
              <SectionCard
                title="Symptoms to watch"
                icon={AlertTriangle}
                items={plan.warningSigns}
                tone="danger"
              />
              <SectionCard
                title="Questions to ask"
                icon={FileText}
                items={plan.questionsToAsk}
                tone="neutral"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    <Sparkles size={14} />
                    Model factors considered
                  </div>
                  <p className="text-[0.82rem] leading-relaxed text-text-secondary">
                    These are the main factors the model used when making the
                    recommendation.
                  </p>
                </div>
                <RiskBadge riskBand={plan.riskBand} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {plan.modelFactors.map((factor) => (
                  <span
                    key={factor}
                    className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[0.72rem] text-text-secondary"
                  >
                    {factor}
                  </span>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b1120] p-4 text-[0.84rem] leading-relaxed text-text-secondary">
                <span className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
                  <CalendarDays size={14} />
                  Suggested next step
                </span>
                <p className="mt-2 wrap-break-word">{plan.reviewWindow}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
