import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

function getInitialScenarioForm(patientData = {}) {
  return {
    Age:
      patientData.Age !== undefined && patientData.Age !== null
        ? String(patientData.Age)
        : "",
    Gender: patientData.Gender ? String(patientData.Gender) : "",
    Risk: patientData.Risk ? String(patientData.Risk) : "",
  };
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

function formatFieldValue(value) {
  if (value === undefined || value === null || value === "") {
    return "Not set";
  }

  return String(value);
}

function toneClasses(tone = "neutral") {
  switch (tone) {
    case "success":
      return "border-success/20 bg-success/10 text-success";
    case "danger":
      return "border-danger/20 bg-danger/10 text-danger";
    case "accent":
      return "border-accent/20 bg-accent/10 text-accent";
    default:
      return "border-white/10 bg-white/[0.04] text-text-secondary";
  }
}

function FieldPill({ label, value, tone = "neutral" }) {
  return (
    <div
      className={`rounded-full border px-3 py-1.5 text-[0.72rem] ${toneClasses(tone)}`}
    >
      <span className="uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <span className="ml-2 font-semibold text-text-primary">
        {formatFieldValue(value)}
      </span>
    </div>
  );
}

function ComparisonCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon,
  className = "",
}) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses(tone)} ${className}`}>
      <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
        {Icon ? <Icon size={14} className="shrink-0" /> : null}
        {label}
      </div>
      <div className="mt-2 text-[1rem] font-semibold text-text-primary">
        {value}
      </div>
      <p className="mt-1.5 text-[0.82rem] leading-relaxed text-text-secondary">
        {detail}
      </p>
    </div>
  );
}

function SimilarCaseCard({ entry, className = "" }) {
  const hasRecurrence = String(entry.Recurred).trim().toLowerCase() === "yes";

  return (
    <div
      className={`min-w-0 rounded-2xl border border-white/10 bg-white/3 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.14)] ${className}`}
    >
      <div className="space-y-3">
        <div className="min-w-0 space-y-1.5">
          <p className="wrap-break-word text-sm font-semibold leading-snug text-text-primary">
            {entry.summary}
          </p>
          <p className="wrap-break-word text-xs leading-relaxed text-text-muted">
            {entry.match_reasons.join(" • ")}
          </p>
        </div>

        <span className="inline-flex self-start rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-accent">
          {entry.match_score.toFixed(1)}% match
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <FieldPill label="Age" value={entry.Age} />
        <FieldPill label="Gender" value={entry.Gender} />
        <FieldPill label="Risk" value={entry.Risk} />
        <FieldPill
          label="Outcome"
          value={entry.outcome_label}
          tone={hasRecurrence ? "danger" : "success"}
        />
      </div>
    </div>
  );
}

export default function ScenarioExplorer({ reportContext = {} }) {
  const patientData = reportContext.patient_data || {};
  const initialScenario = getInitialScenarioForm(patientData);

  const [scenarioForm, setScenarioForm] = useState(initialScenario);
  const [scenarioResult, setScenarioResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);

  const runScenario = async (payload = scenarioForm) => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");
    setScenarioResult(null);

    try {
      const response = await fetch("/api/simulate_risk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_data: patientData,
          scenario: payload,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to build the scenario preview");
      }

      const data = await response.json();
      setScenarioResult(data);
    } catch (err) {
      setError(err.message || "Unable to build the scenario preview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!patientData || Object.keys(patientData).length === 0) {
      return;
    }

    void runScenario(initialScenario);
  }, []);

  const confidenceDelta = scenarioResult?.confidence_delta ?? null;
  const riskDirection = scenarioResult?.risk_direction || "unchanged";
  const deltaTone =
    confidenceDelta === null
      ? "neutral"
      : confidenceDelta > 0
        ? "danger"
        : confidenceDelta < 0
          ? "success"
          : "neutral";
  const DeltaIcon =
    confidenceDelta === null
      ? Sparkles
      : confidenceDelta > 0
        ? TrendingUp
        : confidenceDelta < 0
          ? TrendingDown
          : Sparkles;
  const scenarioRiskTone =
    scenarioResult?.scenario?.risk_label === "high"
      ? "danger"
      : scenarioResult?.scenario?.risk_label === "low"
        ? "success"
        : "neutral";

  const similarCases = scenarioResult?.similar_cases || [];
  const changes = scenarioResult?.changes || [];

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setScenarioForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleReset = () => {
    setScenarioForm(initialScenario);
    void runScenario(initialScenario);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    void runScenario();
  };

  return (
    <div className="bg-card border border-card-border rounded-[20px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-card-border bg-accent/3">
        <div className="flex items-center justify-center w-8.5 h-8.5 bg-accent-glow rounded-[10px] text-accent shrink-0">
          <SlidersHorizontal size={18} />
        </div>
        <div>
          <h3 className="text-[0.95rem] font-bold text-text-primary">
            What-If Simulator
          </h3>
          <p className="text-[0.76rem] text-text-muted mt-0.5">
            Compare a hypothetical patient profile with the current report and
            the closest historical cases.
          </p>
        </div>
      </div>

      <div className="px-6 pt-4 text-[0.82rem] leading-relaxed text-text-muted">
        This panel only uses the fields available in the current project
        version. The report assistant below still explains the original report.
      </div>

      <div className="p-6 space-y-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/3 p-4"
        >
          <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
            <Sparkles size={14} />
            Scenario inputs
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label className="text-[0.72rem] font-semibold uppercase tracking-wider text-text-secondary">
                Age
              </label>
              <input
                type="number"
                name="Age"
                value={scenarioForm.Age}
                onChange={handleInputChange}
                min="1"
                max="120"
                placeholder="e.g. 45"
                className="w-full rounded-[10px] border border-border bg-black/30 px-4 py-3 text-[0.95rem] text-text-primary outline-none transition-all duration-300 placeholder:text-text-muted focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label className="text-[0.72rem] font-semibold uppercase tracking-wider text-text-secondary">
                Gender
              </label>
              <select
                name="Gender"
                value={scenarioForm.Gender}
                onChange={handleInputChange}
                className="w-full cursor-pointer appearance-none rounded-[10px] border border-border bg-[#0d0d14] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%2394a3b8%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M8%2011L3%206h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-position-[right_1rem_center] pr-10 px-4 py-3 text-[0.95rem] text-text-primary outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              >
                <option value="" disabled>
                  Select Gender
                </option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[0.72rem] font-semibold uppercase tracking-wider text-text-secondary">
                Risk Level
              </label>
              <select
                name="Risk"
                value={scenarioForm.Risk}
                onChange={handleInputChange}
                className="w-full cursor-pointer appearance-none rounded-[10px] border border-border bg-[#0d0d14] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%2394a3b8%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M8%2011L3%206h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-position-[right_1rem_center] pr-10 px-4 py-3 text-[0.95rem] text-text-primary outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              >
                <option value="" disabled>
                  Select Risk Level
                </option>
                <option value="Low">Low Risk</option>
                <option value="Intermediate">Intermediate Risk</option>
                <option value="High">High Risk</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-transparent px-4 py-2.5 text-[0.85rem] font-medium text-text-secondary transition-all duration-300 hover:border-text-muted hover:bg-white/3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} />
              Reset to report values
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border-none bg-linear-to-br from-accent to-purple-600 px-4 py-2.5 text-[0.85rem] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(99,102,241,0.4)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Compare scenario
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-white/10 bg-white/3 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
              <Sparkles size={14} />
              Detailed analysis
            </div>
            <p className="mt-1 text-[0.82rem] leading-relaxed text-text-secondary">
              Open the comparison view to see how the scenario changes the
              prediction and which historical cases look most similar.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAnalysis((current) => !current)}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-border bg-transparent px-4 py-2.5 text-[0.85rem] font-semibold text-text-primary transition-all duration-300 hover:border-accent/40 hover:bg-white/3 hover:text-white"
            aria-expanded={showAnalysis}
          >
            {showAnalysis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showAnalysis ? "Hide detailed analysis" : "Show detailed analysis"}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-red-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {showAnalysis && (
          <div className="space-y-4 animate-target animate-in">
            <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
              <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
                <Sparkles size={14} />
                Changed fields
              </div>

              {changes.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {changes.map((change) => (
                    <FieldPill
                      key={change.field}
                      label={change.field}
                      value={`${formatFieldValue(change.from)} → ${formatFieldValue(change.to)}`}
                      tone="accent"
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[0.85rem] leading-relaxed text-text-muted">
                  No changes yet. Compare a different age, gender, or risk level
                  to see how the model shifts.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ComparisonCard
                label="Current report"
                value={
                  reportContext.prediction_text || "Prediction unavailable"
                }
                detail={`Recurrence probability: ${formatPercent(reportContext.confidence)}`}
                tone={
                  reportContext.risk_label === "high" ? "danger" : "success"
                }
                icon={Sparkles}
              />

              <ComparisonCard
                label="Scenario result"
                value={
                  scenarioResult?.scenario?.prediction_text ||
                  (loading
                    ? "Running comparison..."
                    : "Run a scenario to preview the result")
                }
                detail={
                  scenarioResult?.scenario?.confidence !== undefined
                    ? `Recurrence probability: ${formatPercent(scenarioResult.scenario.confidence)}`
                    : "Adjust the inputs to generate a scenario prediction."
                }
                tone={scenarioRiskTone}
                icon={SlidersHorizontal}
              />

              <ComparisonCard
                label="Risk shift"
                value={
                  confidenceDelta === null
                    ? "No scenario yet"
                    : `${confidenceDelta > 0 ? "+" : ""}${confidenceDelta.toFixed(1)}%`
                }
                detail={
                  confidenceDelta === null
                    ? "The difference appears after running a scenario."
                    : scenarioResult?.summary || "Scenario comparison ready."
                }
                tone={deltaTone}
                icon={DeltaIcon}
              />

              <ComparisonCard
                label="Direction"
                value={
                  confidenceDelta === null
                    ? "Waiting"
                    : riskDirection === "increased"
                      ? "Risk increased"
                      : riskDirection === "decreased"
                        ? "Risk decreased"
                        : "No change"
                }
                detail={
                  confidenceDelta === null
                    ? "Run the model to see whether the scenario improves or worsens the risk score."
                    : scenarioResult?.insight || "Scenario comparison ready."
                }
                tone={deltaTone}
                icon={riskDirection === "decreased" ? TrendingDown : TrendingUp}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    <Users size={14} />
                    Similar historical cases
                  </div>
                  <p className="mt-1 text-[0.82rem] leading-relaxed text-text-secondary">
                    These cases are the closest matches from the dataset for the
                    scenario you just ran.
                  </p>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-[0.75rem] text-text-muted">
                    <Loader2 size={14} className="animate-spin text-accent" />
                    Matching records
                  </div>
                )}
              </div>

              {similarCases.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                  {similarCases.map((entry, index) => (
                    <SimilarCaseCard
                      key={`${entry.summary}-${index}`}
                      entry={entry}
                      className="h-full"
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[0.85rem] leading-relaxed text-text-muted">
                  Run a scenario to see the closest cases from the training data
                  and how often they recurred.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
