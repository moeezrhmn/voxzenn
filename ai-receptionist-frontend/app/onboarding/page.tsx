"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { getSession } from "next-auth/react";
// getSession used below in useEffect
import CallInterface from "@/components/CallInterface";

const API = process.env.NEXT_PUBLIC_API_URL!;

type Faq = { q: string; a: string };

type FormData = {
  business_name: string;
  assistant_name: string;
  working_hours: string;
  personality: string;
  greeting: string;
  faqs: Faq[];
};

const PERSONALITIES = [
  { value: "warm, professional", label: "Warm & Professional" },
  { value: "friendly, casual", label: "Friendly & Casual" },
  { value: "formal, professional", label: "Formal & Professional" },
  { value: "energetic, enthusiastic", label: "Energetic & Enthusiastic" },
];

const DEFAULT_GREETING = (name: string) =>
  `Thank you for calling ${name}! How can I help you today?`;

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormData>({
    business_name: "",
    assistant_name: "",
    working_hours: "Mon-Fri 9am-6pm",
    personality: "warm, professional",
    greeting: "",
    faqs: [{ q: "", a: "" }],
  });

  useEffect(() => {
    getSession().then((session) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  const updateForm = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateFaq = (i: number, field: "q" | "a", value: string) =>
    setForm((f) => {
      const faqs = [...f.faqs];
      faqs[i] = { ...faqs[i], [field]: value };
      return { ...f, faqs };
    });

  const addFaq = () =>
    setForm((f) => ({ ...f, faqs: [...f.faqs, { q: "", a: "" }] }));

  const removeFaq = (i: number) =>
    setForm((f) => ({ ...f, faqs: f.faqs.filter((_, idx) => idx !== i) }));

  const saveConfig = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");

    const faqsObj = Object.fromEntries(
      form.faqs.filter((f) => f.q.trim() && f.a.trim()).map((f) => [f.q, f.a])
    );

    const greeting = form.greeting.trim() || DEFAULT_GREETING(form.business_name);

    try {
      const res = await fetch(`${API}/config/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          business_name: form.business_name,
          assistant_name: form.assistant_name.trim(),
          role: "receptionist",
          personality: form.personality,
          capabilities: ["book appointments", "answer FAQs", "provide business information"],
          working_hours: form.working_hours,
          greeting,
          faqs: faqsObj,
        }),
      });
      if (!res.ok) throw new Error("Failed to save config");
      setStep(3);
    } catch (e) {
      setError("Failed to save. Is the backend running?");
    } finally {
      setSaving(false);
    }
  };

  const totalSteps = 4;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--color-bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "var(--space-8)",
    }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: "600px", marginBottom: "var(--space-10)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
          <span style={{ fontWeight: "var(--font-bold)", color: "var(--color-text-primary)", fontSize: "var(--text-lg)", letterSpacing: "-0.02em" }}>
            Voxzenn
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            Step {step} of {totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: "3px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${(step / totalSteps) * 100}%`,
            background: "linear-gradient(90deg, #7c6ff7, #9b90ff)",
            borderRadius: "var(--radius-full)",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Step 1 — Business details */}
      {step === 1 && (
        <div style={{ width: "100%", maxWidth: "520px" }}>
          <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-extrabold)", color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: "var(--space-2)" }}>
            Tell us about your business
          </h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-8)", fontSize: "var(--text-sm)" }}>
            This is how your AI receptionist will introduce itself and behave.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div className="form-group">
              <label className="label" htmlFor="business_name">Business name *</label>
              <input
                id="business_name"
                className="input"
                placeholder="e.g. Sunshine Dental"
                value={form.business_name}
                onChange={(e) => updateForm("business_name", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="assistant_name">AI assistant name</label>
              <input
                id="assistant_name"
                className="input"
                placeholder="e.g. Sophia, Alex, Aria"
                value={form.assistant_name}
                onChange={(e) => updateForm("assistant_name", e.target.value)}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                Your AI will introduce itself by this name on every call.
              </span>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="working_hours">Working hours</label>
              <input
                id="working_hours"
                className="input"
                placeholder="e.g. Mon-Fri 9am-6pm"
                value={form.working_hours}
                onChange={(e) => updateForm("working_hours", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="personality">AI personality</label>
              <select
                id="personality"
                className="input"
                value={form.personality}
                onChange={(e) => updateForm("personality", e.target.value)}
                style={{ cursor: "pointer" }}
              >
                {PERSONALITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="greeting">AI greeting message</label>
              <textarea
                id="greeting"
                className="input"
                rows={2}
                placeholder={DEFAULT_GREETING(form.business_name || "your business")}
                value={form.greeting}
                onChange={(e) => updateForm("greeting", e.target.value)}
                style={{ resize: "vertical", lineHeight: 1.6 }}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                Leave blank to use the default greeting above.
              </span>
            </div>
          </div>

          <div style={{ marginTop: "var(--space-8)" }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={!form.business_name.trim()}
              onClick={() => setStep(2)}
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — FAQs */}
      {step === 2 && (
        <div style={{ width: "100%", maxWidth: "520px" }}>
          <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-extrabold)", color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: "var(--space-2)" }}>
            Add your FAQs
          </h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-8)", fontSize: "var(--text-sm)" }}>
            Your AI will use these to answer common questions from callers. You can add more later.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {form.faqs.map((faq, i) => (
              <div key={i} className="card" style={{ padding: "var(--space-4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: "var(--font-medium)" }}>
                    FAQ {i + 1}
                  </span>
                  {form.faqs.length > 1 && (
                    <button onClick={() => removeFaq(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <input
                    className="input"
                    placeholder="Question (e.g. Do you accept insurance?)"
                    value={faq.q}
                    onChange={(e) => updateFaq(i, "q", e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Answer (e.g. Yes, we accept Delta Dental and Cigna.)"
                    value={faq.a}
                    onChange={(e) => updateFaq(i, "a", e.target.value)}
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addFaq}
              className="btn btn-secondary"
              style={{ alignSelf: "flex-start" }}
            >
              <Plus size={14} /> Add FAQ
            </button>
          </div>

          {error && (
            <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: "var(--space-8)", display: "flex", gap: "var(--space-3)" }}>
            <button onClick={() => setStep(1)} className="btn btn-secondary btn-lg" style={{ gap: "var(--space-2)" }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={saveConfig}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save & Test →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Test call */}
      {step === 3 && userId && (
        <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-extrabold)", color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: "var(--space-2)" }}>
              Test your AI
            </h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
              Make a live call to hear your AI receptionist. Try booking an appointment.
            </p>
          </div>

          <CallInterface clientId={userId} />

          <div style={{ display: "flex", gap: "var(--space-3)", width: "100%" }}>
            <button onClick={() => setStep(2)} className="btn btn-secondary btn-lg" style={{ gap: "var(--space-2)" }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="btn btn-primary btn-lg"
              style={{ flex: 1, justifyContent: "center" }}
            >
              Looks good, go live →
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Done */}
      {step === 4 && (
        <div style={{ width: "100%", maxWidth: "480px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "var(--space-5)" }}>
            <CheckCircle size={64} color="var(--color-success)" strokeWidth={1.5} style={{ margin: "0 auto" }} />
          </div>
          <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-extrabold)", color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: "var(--space-3)" }}>
            Your AI receptionist is live!
          </h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-8)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--color-text-primary)" }}>{form.business_name}</strong> is ready to answer calls.
            You can edit your config anytime from the Settings page in your dashboard.
          </p>

          <button
            onClick={() => router.push("/dashboard")}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Go to Dashboard <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
