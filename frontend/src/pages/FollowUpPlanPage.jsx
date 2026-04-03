import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowLeft, CalendarDays, Sparkles } from "lucide-react";
import FollowUpPlanner from "../components/FollowUpPlanner";

function SummaryChip({ label, value }) {
  if (!value) return null;

  return (
    <div className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[0.72rem] text-text-secondary">
      <span className="uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <span className="ml-2 font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function getPredictionConfidence(reportContext = {}) {
  const rawConfidence =
    typeof reportContext.confidence === "number"
      ? reportContext.confidence
      : null;

  if (rawConfidence === null) {
    return null;
  }

  return String(reportContext.risk_label || "").toLowerCase() === "low"
    ? 100 - rawConfidence
    : rawConfidence;
}

export default function FollowUpPlanPage() {
  const location = useLocation();
  const data = location.state;

  if (!data) {
    return <Navigate to="/predict" replace />;
  }

  const predictionConfidence = getPredictionConfidence(data);
  const confidenceValue =
    predictionConfidence !== null
      ? `${predictionConfidence.toFixed(1)}%`
      : "Not available";

  return (
    <div className="flex justify-center items-start min-h-screen px-4 py-8">
      <div className="w-full max-w-170 flex flex-col gap-6 pt-4">
        <Link
          to="/report"
          state={data}
          className="inline-flex items-center gap-1.5 text-text-muted text-[0.85rem] font-medium hover:text-accent transition-colors no-underline"
        >
          <ArrowLeft size={16} />
          Back to report
        </Link>

        <div className="bg-card border border-card-border rounded-[20px] overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-card-border bg-accent/3">
            <div className="flex items-center justify-center w-9.5 h-9.5 bg-accent-glow rounded-xl text-accent shrink-0">
              <CalendarDays size={20} />
            </div>
            <div>
              <h1 className="text-[1.05rem] font-bold m-0">
                Dedicated Follow-Up Route
              </h1>
              <p className="text-[0.78rem] text-text-muted mt-0.5">
                This page keeps the follow-up plan separate from the main report
                so the layout stays cleaner.
              </p>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4 space-y-3">
              <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
                <Sparkles size={14} />
                Report snapshot
              </div>
              <p className="text-[0.9rem] leading-relaxed text-text-secondary wrap-break-word">
                {data.prediction_text || "Prediction unavailable"}
              </p>
              <div className="flex flex-wrap gap-2">
                <SummaryChip
                  label="Prediction confidence"
                  value={confidenceValue}
                />
                <SummaryChip
                  label="Risk"
                  value={
                    data.risk_label
                      ? String(data.risk_label).toUpperCase()
                      : "Not available"
                  }
                />
                <SummaryChip
                  label="Key factors"
                  value={
                    Array.isArray(data.top_features)
                      ? String(data.top_features.length)
                      : "0"
                  }
                />
              </div>
            </div>

            <p className="text-[0.84rem] leading-relaxed text-text-muted">
              The planner below opens with the detailed section expanded, so you
              can focus on the review timeline, warning signs, and questions to
              ask without the extra clicks from the report page.
            </p>
          </div>
        </div>

        <FollowUpPlanner reportContext={data} defaultOpen />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/report"
            state={data}
            className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-transparent text-text-secondary border border-border rounded-xl text-[0.88rem] font-medium no-underline hover:text-text-primary hover:border-text-muted hover:bg-white/3 transition-all duration-300"
          >
            <ArrowLeft size={16} />
            Back to report
          </Link>

          <Link
            to="/predict"
            className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-linear-to-br from-accent to-purple-600 text-white rounded-xl text-[0.88rem] font-semibold no-underline shadow-[0_4px_14px_rgba(99,102,241,0.25)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] transition-all duration-300"
          >
            New Prediction
          </Link>
        </div>
      </div>
    </div>
  );
}
