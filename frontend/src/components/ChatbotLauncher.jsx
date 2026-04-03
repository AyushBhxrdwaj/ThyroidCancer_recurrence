import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";

const quickPrompts = [
  "What does this result mean in simple words?",
  "Why was the risk predicted this way?",
  "What should I focus on next?",
];

function getPredictionConfidence(reportContext) {
  const rawConfidence =
    typeof reportContext?.confidence === "number"
      ? reportContext.confidence
      : null;

  if (rawConfidence === null) {
    return null;
  }

  return String(reportContext?.risk_label || "").toLowerCase() === "low"
    ? 100 - rawConfidence
    : rawConfidence;
}

function buildWelcomeMessage(reportContext) {
  const prediction = reportContext?.prediction_text?.trim();

  const summary = prediction
    ? `I can help explain this report. The current result is ${prediction}.`
    : "I can help explain this report once the prediction is available.";

  return {
    role: "assistant",
    content: `${summary} Ask me about the meaning of the result, the factors involved, or what the explanation means in plain language.`,
  };
}

function SummaryChip({ label, value }) {
  if (!value) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[0.7rem] text-text-secondary">
      <span className="uppercase tracking-[0.22em] text-text-muted">
        {label}
      </span>
      <span className="max-w-37.5 truncate text-text-primary">{value}</span>
    </div>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-2xl border px-3.5 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "border-accent/20 bg-accent/12 text-text-primary"
            : "border-white/10 bg-white/5 text-text-secondary"
        }`}
      >
        <div
          className={`mb-2 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.24em] ${
            isUser ? "justify-end text-accent" : "text-accent"
          }`}
        >
          {!isUser && <Bot size={11} />}
          {isUser ? "You" : "Assistant"}
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export default function ChatbotLauncher({ reportContext = {} }) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    buildWelcomeMessage(reportContext),
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 650);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setMessages([buildWelcomeMessage(reportContext)]);
    setInput("");
    setError("");
    setSending(false);
  }, [reportContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, sending]);

  const patientData = reportContext.patient_data || {};
  const keyFactors = Array.isArray(reportContext.top_features)
    ? reportContext.top_features.slice(0, 3)
    : [];
  const predictionConfidence = getPredictionConfidence(reportContext);
  const confidenceValue =
    predictionConfidence !== null
      ? `${predictionConfidence.toFixed(1)}%`
      : null;
  const summaryItems = [
    { label: "Result", value: reportContext.prediction_text },
    { label: "Prediction confidence", value: confidenceValue },
    { label: "Age", value: patientData.Age ? String(patientData.Age) : "" },
    {
      label: "Gender",
      value: patientData.Gender ? String(patientData.Gender) : "",
    },
    { label: "Risk", value: patientData.Risk ? String(patientData.Risk) : "" },
  ];

  const sendQuestion = async (questionText) => {
    const question = (questionText ?? input).trim();
    if (!question || sending) {
      return;
    }

    const updatedMessages = [...messages, { role: "user", content: question }];
    setMessages(updatedMessages);
    setInput("");
    setError("");
    setSending(true);

    try {
      const response = await fetch("/api/report_chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          messages,
          report_context: reportContext,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }

      const data = await response.json();
      const assistantReply =
        (data.answer || "").trim() ||
        "I could not generate a response right now. Please try again.";

      setMessages((current) => [
        ...current,
        { role: "assistant", content: assistantReply },
      ]);
    } catch (err) {
      setError(err.message || "Unable to reach the assistant.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "I could not reach the report assistant right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion();
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 transition-all duration-300 sm:bottom-6 sm:right-6 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      {open && (
        <div className="flex max-h-[calc(100vh-4.5rem)] w-70 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#070b14]/95 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:w-75">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Bot size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  AI Report Assistant
                </p>
                <p className="text-xs text-text-muted">
                  Connected to this report context
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
              aria-label="Close chatbot preview"
            >
              <X size={16} />
            </button>
          </div>

          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {summaryItems.map((item) => (
                <SummaryChip
                  key={item.label}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>

            {keyFactors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-accent">
                  <Sparkles size={11} />
                  Key factors
                </span>
                {keyFactors.map((factor) => (
                  <span
                    key={factor}
                    className="max-w-37.5 truncate rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-[0.7rem] text-text-secondary"
                    title={factor}
                  >
                    {factor}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-text-muted">
              Ask me what the result means, why the report looks this way, or
              how to interpret the explanation in plain language.
            </p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <ChatBubble key={`${message.role}-${index}`} message={message} />
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-text-secondary">
                  <Loader2 size={14} className="animate-spin text-accent" />
                  Thinking about the report...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendQuestion(prompt)}
                  disabled={sending}
                  className="rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-left text-[0.7rem] leading-snug text-text-secondary transition-colors hover:border-accent/30 hover:bg-white/6 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about this report..."
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0b1120] px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/50"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-purple-600 text-white shadow-[0_6px_18px_rgba(99,102,241,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(99,102,241,0.35)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                aria-label="Send question"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>

            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Open report assistant"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(99,102,241,0.28))] text-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent/60 focus:ring-offset-2 focus:ring-offset-bg"
      >
        <span className="absolute inset-0 rounded-full bg-accent/25 animate-ping" />
        <span className="absolute inset-1 rounded-full border border-white/10" />
        <Bot size={24} className="relative z-10" />
      </button>
    </div>
  );
}
