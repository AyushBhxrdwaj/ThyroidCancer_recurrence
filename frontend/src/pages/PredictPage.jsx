import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  AlertTriangle,
  Zap,
  Lock,
  ClipboardList,
  XCircle,
} from "lucide-react";

/* ── Progress Bar Component ── */
function ProgressBar({ currentStep }) {
  const steps = ["Patient Details", "AI Analysis", "Download Report"];

  return (
    <div className="flex items-center justify-center py-4">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.8rem] font-bold border-2 transition-all duration-300 ${
                i < currentStep
                  ? "border-success text-white bg-success"
                  : i === currentStep
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-text-muted bg-bg"
              }`}
            >
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span
              className={`text-[0.72rem] font-medium whitespace-nowrap ${
                i <= currentStep ? "text-text-secondary" : "text-text-muted"
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-[60px] h-0.5 mx-2 mb-5 rounded-sm ${
                i < currentStep ? "bg-accent" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Predict Page ── */
export default function PredictPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    Age: "",
    Gender: "",
    Risk: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const data = await res.json();
      // Navigate to report page with the prediction data
      navigate("/report", { state: data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen px-4 py-8">
      <div className="w-full max-w-[560px] flex flex-col gap-6 pt-4">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-text-muted text-[0.85rem] font-medium hover:text-accent transition-colors no-underline"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        {/* Progress */}
        <ProgressBar currentStep={0} />

        {/* Form Card */}
        <div className="bg-card p-9 rounded-[20px] border border-card-border shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-accent to-purple-600 rounded-[14px] text-white mb-3">
              <ClipboardList size={22} />
            </div>
            <h2 className="text-[1.25rem] font-bold tracking-tight mb-1">
              Patient Details
            </h2>
            <p className="text-[0.85rem] text-text-muted leading-relaxed mt-2">
              Fill in the clinical information below. Our AI model will analyze
              the data and predict the likelihood of thyroid cancer recurrence.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center justify-center gap-2 bg-danger/[0.08] border border-danger/20 text-red-300 px-4 py-3 rounded-[10px] text-[0.88rem] mb-4">
              <XCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-1">
            {/* Age */}
            <div className="flex flex-col gap-1.5 mb-2">
              <label className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">
                <User size={14} className="text-text-muted" />
                Age
              </label>
              <input
                type="number"
                name="Age"
                value={formData.Age}
                onChange={handleChange}
                placeholder="e.g. 45"
                required
                min="1"
                max="120"
                className="w-full px-4 py-3 bg-black/30 border border-border rounded-[10px] text-text-primary text-[0.95rem] outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] placeholder:text-text-muted"
              />
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5 mb-2">
              <label className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">
                <User size={14} className="text-text-muted" />
                Gender
              </label>
              <select
                name="Gender"
                value={formData.Gender}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-[#0d0d14] border border-border rounded-[10px] text-text-primary text-[0.95rem] outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%2394a3b8%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M8%2011L3%206h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center] pr-10"
              >
                <option value="" disabled>
                  Select Gender
                </option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Risk Level */}
            <div className="flex flex-col gap-1.5 mb-2">
              <label className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">
                <AlertTriangle size={14} className="text-text-muted" />
                Risk Level
              </label>
              <select
                name="Risk"
                value={formData.Risk}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-[#0d0d14] border border-border rounded-[10px] text-text-primary text-[0.95rem] outline-none transition-all duration-300 focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%2394a3b8%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M8%2011L3%206h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center] pr-10"
              >
                <option value="" disabled>
                  Select Risk Level
                </option>
                <option value="Low">Low Risk</option>
                <option value="Intermediate">Intermediate Risk</option>
                <option value="High">High Risk</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-accent to-purple-600 text-white py-3.5 rounded-xl text-[0.95rem] font-semibold mt-3 transition-all duration-300 shadow-[0_4px_16px_rgba(99,102,241,0.25)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(99,102,241,0.4)] active:translate-y-0 active:shadow-[0_2px_8px_rgba(99,102,241,0.2)] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 cursor-pointer border-none"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Analyze & Predict
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 mt-5 pt-4 border-t border-border">
            <Lock size={14} className="text-text-muted" />
            <span className="text-[0.78rem] text-text-muted">
              Your data is processed securely and never stored.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
