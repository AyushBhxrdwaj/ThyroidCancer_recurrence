import { Link, useLocation, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  CheckCircle,
  AlertTriangle,
  Zap,
  HelpCircle,
  List,
  FileText,
  Download,
  Plus,
} from "lucide-react";

/* ── Progress Bar Component ── */
function ProgressBar() {
  const steps = ["Patient Details", "AI Analysis", "Download Report"];
  return (
    <div className="flex items-center justify-center py-4">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.8rem] font-bold border-2 transition-all duration-300 ${
                i === 0
                  ? "border-success text-white bg-success"
                  : "border-accent text-accent bg-accent/10"
              }`}
            >
              {i === 0 ? "✓" : i + 1}
            </div>
            <span className="text-[0.72rem] font-medium whitespace-nowrap text-text-secondary">
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="w-[60px] h-0.5 mx-2 mb-5 rounded-sm bg-accent" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Explanation Parser ── */
function ExplanationBody({ explanation }) {
  if (!explanation) return null;

  const lines = explanation.split("\n");
  const elements = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Section headings
    if (
      trimmed.startsWith("What This Means") ||
      trimmed.startsWith("Key Factors") ||
      trimmed.startsWith("What You Can Do")
    ) {
      let icon;
      if (trimmed.includes("What This Means")) {
        icon = <HelpCircle size={16} className="text-accent shrink-0" />;
      } else if (trimmed.includes("Key Factors")) {
        icon = <List size={16} className="text-accent shrink-0" />;
      } else {
        icon = <CheckCircle size={16} className="text-accent shrink-0" />;
      }

      elements.push(
        <h4
          key={`heading-${idx}`}
          className="flex items-center gap-2 text-[0.88rem] font-bold text-text-primary uppercase tracking-wider mt-3 mb-1 pb-2 border-b border-border first:mt-0"
        >
          {icon}
          {trimmed}
        </h4>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      // Bullet points
      elements.push(
        <div
          key={`bullet-${idx}`}
          className="flex items-start gap-2.5 py-1 pl-1"
        >
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent mt-2" />
          <span className="text-[0.9rem] leading-relaxed text-text-secondary">
            {trimmed.slice(2)}
          </span>
        </div>,
      );
    } else {
      // Normal paragraph
      elements.push(
        <p
          key={`p-${idx}`}
          className="text-[0.92rem] leading-relaxed text-text-secondary m-0"
        >
          {trimmed}
        </p>,
      );
    }
  });

  return <>{elements}</>;
}

/* ── Report Page ── */
export default function ReportPage() {
  const location = useLocation();
  const data = location.state;

  // Redirect if no data (direct access)
  if (!data) {
    return <Navigate to="/predict" replace />;
  }

  const { prediction_text, explanation } = data;
  const isUnlikely = prediction_text?.includes("Unlikely");

  return (
    <div className="flex justify-center items-start min-h-screen px-4 py-8">
      <div className="w-full max-w-[680px] flex flex-col gap-6 pt-4">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-text-muted text-[0.85rem] font-medium hover:text-accent transition-colors no-underline"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        {/* Progress */}
        <ProgressBar />

        {/* Prediction Result Card */}
        <div className="bg-card border border-card-border rounded-[20px] overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.3)]">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-card-border bg-accent/[0.03]">
            <div className="flex items-center justify-center w-[38px] h-[38px] bg-accent-glow rounded-xl text-accent shrink-0">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-[1.05rem] font-bold m-0">
                Prediction Result
              </h2>
              <p className="text-[0.78rem] text-text-muted mt-0.5">
                AI-generated clinical analysis
              </p>
            </div>
          </div>

          {/* Result Badge */}
          <div
            className={`mx-6 my-6 px-6 py-5 rounded-xl flex items-center gap-4 ${
              isUnlikely
                ? "bg-success/[0.06] border border-success/20"
                : "bg-danger/[0.06] border border-danger/20"
            }`}
          >
            <div
              className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] ${
                isUnlikely ? "text-success" : "text-danger"
              }`}
            >
              {isUnlikely ? (
                <CheckCircle size={24} />
              ) : (
                <AlertTriangle size={24} />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className={`text-[0.75rem] font-bold uppercase tracking-widest ${
                  isUnlikely ? "text-success" : "text-danger"
                }`}
              >
                {isUnlikely ? "Low Risk" : "High Risk"}
              </span>
              <span className="text-base font-semibold text-text-primary">
                {prediction_text}
              </span>
            </div>
          </div>
        </div>

        {/* AI Explanation Section */}
        {explanation && (
          <div className="bg-card border border-card-border rounded-[20px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-3 px-6 py-5 bg-accent/[0.03] border-b border-card-border">
              <div className="flex items-center justify-center w-[34px] h-[34px] bg-accent-glow rounded-[10px] text-accent shrink-0">
                <Zap size={18} />
              </div>
              <div>
                <h3 className="text-[0.95rem] font-bold text-text-primary">
                  AI-Powered Explanation
                </h3>
                <p className="text-[0.76rem] text-text-muted mt-0.5">
                  AI-generated for easy understanding
                </p>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-2">
              <ExplanationBody explanation={explanation} />
            </div>
          </div>
        )}

        {/* Download Section */}
        <div className="mt-1">
          <div className="flex items-center justify-between bg-card border border-card-border rounded-2xl px-5 py-4 gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-3 text-text-muted">
              <FileText size={20} />
              <div className="flex flex-col">
                <span className="text-[0.88rem] font-semibold text-text-primary">
                  Clinical Report (PDF)
                </span>
                <span className="text-[0.75rem] text-text-muted">
                  Professionally formatted prediction report
                </span>
              </div>
            </div>
            <a
              href="/api/download_report"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-accent to-purple-600 text-white rounded-[10px] text-[0.85rem] font-semibold no-underline whitespace-nowrap shadow-[0_4px_14px_rgba(99,102,241,0.25)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] transition-all duration-300"
            >
              <Download size={18} />
              Download PDF
            </a>
          </div>
        </div>

        {/* New Prediction */}
        <div className="text-center">
          <Link
            to="/predict"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-transparent text-text-secondary border border-border rounded-xl text-[0.88rem] font-medium no-underline hover:text-text-primary hover:border-text-muted hover:bg-white/[0.03] transition-all duration-300"
          >
            <Plus size={16} />
            New Prediction
          </Link>
        </div>
      </div>
    </div>
  );
}
