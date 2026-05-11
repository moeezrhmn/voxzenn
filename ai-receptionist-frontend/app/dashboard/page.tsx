"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Calendar, BarChart2, LogOut, ChevronDown, ChevronUp, Settings, Save, PhoneCall, Trash2, Plus } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import CallInterface from "@/components/CallInterface";

const API = process.env.NEXT_PUBLIC_API_URL!;

type Booking = {
  id: string;
  patient_name: string;
  phone: string;
  day: string;
  time: string;
  reason: string;
  created_at: string;
};

type Call = {
  id: string;
  started_at: string;
  ended_at: string | null;
  transcript: { role: string; content: string }[];
  summary: string | null;
};

type Config = {
  business_name: string;
  assistant_name: string;
  personality: string;
  working_hours: string;
  greeting: string;
  faqs: Record<string, string>;
};

type ActiveView = "overview" | "calls" | "bookings" | "settings" | "test-call";
const VALID_TABS: ActiveView[] = ["overview", "calls", "bookings", "test-call", "settings"];

export default function Dashboard() {
  // useSearchParams requires a Suspense boundary in Next 15.
  return (
    <Suspense fallback={<div style={{ padding: "var(--space-8)", color: "var(--color-text-muted)" }}>Loading...</div>}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [calls, setCalls] = useState<Call[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const clientId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;

  // Tab lives in URL (?tab=settings) so refresh / share keeps the view.
  const tabParam = searchParams.get("tab");
  const activeView: ActiveView = VALID_TABS.includes(tabParam as ActiveView) ? (tabParam as ActiveView) : "overview";

  const setActiveView = (view: ActiveView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", view);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (!clientId) return;

    let cancelled = false;
    (async () => {
      const configRes = await fetch(`${API}/config/${clientId}`);
      if (cancelled) return;
      if (!configRes.ok) { router.replace("/onboarding"); return; }
      const cfg = await configRes.json();
      // Defensive: legacy rows may have faqs stored as a JSON-encoded string
      if (typeof cfg.faqs === "string") {
        try { cfg.faqs = JSON.parse(cfg.faqs || "{}"); } catch { cfg.faqs = {}; }
      }
      setConfig(cfg);

      const [callsRes, bookingsRes] = await Promise.all([
        fetch(`${API}/calls/${clientId}`),
        fetch(`${API}/bookings/${clientId}`),
      ]);
      if (cancelled) return;
      setCalls(await callsRes.json());
      setBookings(await bookingsRes.json());
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [status, clientId, router]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.replace("/");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const callDuration = (call: { ended_at: string | null; started_at: string }) => {
    if (!call.ended_at) return "—";
    const secs = Math.round(
      (new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000
    );
    return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const avgDuration = () => {
    const ended = calls.filter((c) => c.ended_at);
    if (!ended.length) return "—";
    const avg = Math.round(
      ended.reduce((acc, c) => acc + (new Date(c.ended_at!).getTime() - new Date(c.started_at).getTime()) / 1000, 0) / ended.length
    );
    return avg < 60 ? `${avg}s` : `${Math.floor(avg / 60)}m ${avg % 60}s`;
  };

  const navItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart2 size={16} /> },
    { id: "calls", label: "Calls", icon: <Phone size={16} /> },
    { id: "bookings", label: "Bookings", icon: <Calendar size={16} /> },
    { id: "test-call", label: "Test Call", icon: <PhoneCall size={16} /> },
    { id: "settings", label: "Settings", icon: <Settings size={16} /> },
  ];

  const pageTitles: Record<ActiveView, { title: string; desc: string }> = {
    overview: { title: "Overview", desc: "Summary of all calls and appointments." },
    calls: { title: "Call History", desc: "All calls with full transcripts." },
    bookings: { title: "Bookings", desc: "All appointments booked by your AI receptionist." },
    "test-call": { title: "Test Call", desc: "Call your AI receptionist and hear it in action." },
    settings: { title: "Settings", desc: "Edit your AI receptionist configuration." },
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: "var(--space-5)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Phone size={16} color="var(--color-brand)" />
          <span style={{ fontWeight: "var(--font-bold)", color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>Voxzenn</span>
        </div>

        {/* Business badge */}
        <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "var(--radius-md)", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
              🏢
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {config?.business_name ?? "Loading..."}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>AI Receptionist</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "var(--space-3)" }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* User + sign out */}
        <div style={{ borderTop: "1px solid var(--color-border)", padding: "var(--space-4) var(--space-5)" }}>
          {userEmail && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userEmail}
            </div>
          )}
          <button onClick={handleSignOut} className="nav-item" style={{ color: "var(--color-danger)" }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)", color: "var(--color-text-primary)", letterSpacing: "-0.02em", marginBottom: "var(--space-1)" }}>
            {pageTitles[activeView].title}
          </h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            {pageTitles[activeView].desc}
          </p>
        </div>

        {loading ? (
          <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Loading...</div>
        ) : (
          <>
            {activeView === "overview" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
                  {[
                    { label: "Total Calls", value: calls.length },
                    { label: "Appointments Booked", value: bookings.length },
                    { label: "Avg Duration", value: avgDuration() },
                    { label: "Active Calls", value: calls.filter(c => !c.ended_at).length },
                  ].map((stat) => (
                    <div key={stat.label} className="stat-card">
                      <div className="stat-value">{stat.value}</div>
                      <div className="stat-label">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: "var(--space-8)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                    <h2 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)" }}>Recent Bookings</h2>
                    <button onClick={() => setActiveView("bookings")} style={{ fontSize: "var(--text-xs)", color: "var(--color-brand)", background: "none", border: "none", cursor: "pointer" }}>View all →</button>
                  </div>
                  <BookingsTable bookings={bookings.slice(0, 5)} formatDate={formatDate} />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                    <h2 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)" }}>Recent Calls</h2>
                    <button onClick={() => setActiveView("calls")} style={{ fontSize: "var(--text-xs)", color: "var(--color-brand)", background: "none", border: "none", cursor: "pointer" }}>View all →</button>
                  </div>
                  <CallsList calls={calls.slice(0, 3)} expandedCall={expandedCall} setExpandedCall={setExpandedCall} formatDate={formatDate} callDuration={callDuration} />
                </div>
              </>
            )}

            {activeView === "bookings" && (
              <BookingsTable bookings={bookings} formatDate={formatDate} />
            )}

            {activeView === "calls" && (
              <CallsList calls={calls} expandedCall={expandedCall} setExpandedCall={setExpandedCall} formatDate={formatDate} callDuration={callDuration} />
            )}

            {activeView === "test-call" && clientId && config && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-6)" }}>
                <div style={{ padding: "var(--space-4) var(--space-5)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", border: "1px solid var(--color-border)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", maxWidth: "420px" }}>
                  This is a live test of your AI receptionist using your current configuration. Click the call button and speak naturally — it will respond exactly as it would for a real caller.
                </div>
                <CallInterface clientId={clientId} businessName={config.business_name} />
              </div>
            )}

            {activeView === "settings" && config && clientId && (
              <SettingsForm
                config={config}
                clientId={clientId}
                userId={clientId}
                onSaved={(updated) => setConfig(updated)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ── Settings Form ─────────────────────────────────────── */
function SettingsForm({ config, clientId, userId, onSaved }: {
  config: Config;
  clientId: string;
  userId: string;
  onSaved: (c: Config) => void;
}) {
  const [form, setForm] = useState<Config & { faqList: { q: string; a: string }[] }>({
    ...config,
    faqList: Object.entries(config.faqs ?? {}).map(([q, a]) => ({ q, a })),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const updateFaq = (i: number, field: "q" | "a", value: string) =>
    setForm((f) => { const list = [...f.faqList]; list[i] = { ...list[i], [field]: value }; return { ...f, faqList: list }; });

  const addFaq = () => setForm((f) => ({ ...f, faqList: [...f.faqList, { q: "", a: "" }] }));
  const removeFaq = (i: number) => setForm((f) => ({ ...f, faqList: f.faqList.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    setSaving(true); setError(""); setSaved(false);
    const faqs = Object.fromEntries(form.faqList.filter(f => f.q.trim() && f.a.trim()).map(f => [f.q, f.a]));
    try {
      const res = await fetch(`${API}/config/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          business_name: form.business_name,
          assistant_name: form.assistant_name,
          role: "receptionist",
          personality: form.personality,
          capabilities: ["book appointments", "answer FAQs", "provide business information"],
          working_hours: form.working_hours,
          greeting: form.greeting,
          faqs,
        }),
      });
      if (!res.ok) throw new Error();
      onSaved({ ...form, faqs });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Is the backend running?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "560px", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div className="card" style={{ padding: "var(--space-6)" }}>
        <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)", marginBottom: "var(--space-5)" }}>
          Business Info
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="form-group">
            <label className="label">Business name</label>
            <input className="input" value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">AI assistant name</label>
            <input className="input" placeholder="e.g. Sophia, Alex, Aria" value={form.assistant_name ?? ""} onChange={e => setForm(f => ({ ...f, assistant_name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Working hours</label>
            <input className="input" value={form.working_hours} onChange={e => setForm(f => ({ ...f, working_hours: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">AI personality</label>
            <input className="input" value={form.personality} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">AI greeting</label>
            <textarea className="input" rows={2} value={form.greeting ?? ""} onChange={e => setForm(f => ({ ...f, greeting: e.target.value }))} style={{ resize: "vertical", lineHeight: 1.6 }} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              Leave blank to auto-generate using your AI assistant&apos;s name. A custom greeting will only be used if it includes the AI&apos;s name.
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-5)", gap: "var(--space-4)" }}>
          <div>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>
              FAQs
            </h3>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              Common questions and answers your AI receptionist will use when callers ask.
            </p>
          </div>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", whiteSpace: "nowrap", padding: "var(--space-1) var(--space-3)", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-full)", border: "1px solid var(--color-border)" }}>
            {form.faqList.length} {form.faqList.length === 1 ? "question" : "questions"}
          </span>
        </div>

        {form.faqList.length === 0 ? (
          <div style={{ padding: "var(--space-8) var(--space-4)", textAlign: "center", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            No FAQs yet. Add a few common questions so your AI can answer callers accurately.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {form.faqList.map((faq, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-4) var(--space-5)",
                  background: "var(--color-bg-subtle)",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    FAQ {i + 1}
                  </span>
                  <button
                    onClick={() => removeFaq(i)}
                    title="Remove this FAQ"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                      background: "none",
                      border: "1px solid transparent",
                      cursor: "pointer",
                      color: "var(--color-text-muted)",
                      padding: "var(--space-1) var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--text-xs)",
                      transition: "all var(--transition-fast)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--color-danger)"; e.currentTarget.style.borderColor = "var(--color-danger-light)"; e.currentTarget.style.background = "var(--color-danger-light)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "none"; }}
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                </div>
                <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
                  <label className="label" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>Question</label>
                  <input
                    className="input"
                    placeholder="e.g. What are your hours?"
                    value={faq.q}
                    onChange={e => updateFaq(i, "q", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="label" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>Answer</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g. We're open Monday to Friday, 9am to 6pm."
                    value={faq.a}
                    onChange={e => updateFaq(i, "a", e.target.value)}
                    style={{ resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={addFaq}
          className="btn btn-secondary"
          style={{ alignSelf: "flex-start", marginTop: "var(--space-4)", gap: "var(--space-2)" }}
        >
          <Plus size={14} />
          Add FAQ
        </button>
      </div>

      {error && (
        <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
          {error}
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start", gap: "var(--space-2)" }}>
        <Save size={16} />
        {saving ? "Saving..." : saved ? "Saved!" : "Save changes"}
      </button>
    </div>
  );
}

/* ── Bookings Table ────────────────────────────────────── */
// Format an ISO date (YYYY-MM-DD) into "Tue, May 5". Falls back to raw on parse failure.
function formatBookingDay(day: string): string {
  if (!day) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Format a 24h "HH:MM" into "11:00 AM". Falls back to raw.
function formatBookingTime(time: string): string {
  if (!time) return "—";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  let h = +m[1];
  const min = m[2];
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${period}`;
}

// Format a digits-only phone for display: 5551234567 → (555) 123-4567
function formatBookingPhone(phone: string): string {
  if (!phone) return "—";
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return phone;
}

function BookingsTable({ bookings, formatDate }: {
  bookings: Booking[];
  formatDate: (iso: string) => string;
}) {
  if (!bookings.length) return (
    <div className="card" style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      No bookings yet
    </div>
  );
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="table">
        <thead><tr>{["Patient", "Phone", "Date", "Time", "Reason", "Booked"].map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id}>
              <td style={{ color: "var(--color-text-primary)", fontWeight: "var(--font-medium)" }}>{b.patient_name}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatBookingPhone(b.phone)}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatBookingDay(b.day)}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatBookingTime(b.time)}</td>
              <td>{b.reason || "—"}</td>
              <td style={{ color: "var(--color-text-muted)" }}>{formatDate(b.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Calls List ────────────────────────────────────────── */
function CallsList({ calls, expandedCall, setExpandedCall, formatDate, callDuration }: {
  calls: Call[];
  expandedCall: string | null;
  setExpandedCall: (id: string | null) => void;
  formatDate: (iso: string) => string;
  callDuration: (call: { ended_at: string | null; started_at: string }) => string;
}) {
  if (!calls.length) return (
    <div className="card" style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
      No calls yet
    </div>
  );
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {calls.map((call, i) => (
        <div key={call.id} style={{ borderBottom: i < calls.length - 1 ? "1px solid var(--color-border)" : "none" }}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-4) var(--space-5)", cursor: "pointer" }}
            onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg-subtle)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-full)", background: call.ended_at ? "var(--color-bg-subtle)" : "rgba(52,211,153,0.1)", border: `1px solid ${call.ended_at ? "var(--color-border)" : "rgba(52,211,153,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Phone size={14} color={call.ended_at ? "var(--color-text-muted)" : "var(--color-success)"} />
              </div>
              <div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--color-text-primary)" }}>{formatDate(call.started_at)}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "2px" }}>{call.transcript.length} messages · {callDuration(call)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span className={`badge ${call.ended_at ? "badge-gray" : "badge-green"}`}>{call.ended_at ? "Ended" : "Active"}</span>
              {expandedCall === call.id ? <ChevronUp size={14} color="var(--color-text-muted)" /> : <ChevronDown size={14} color="var(--color-text-muted)" />}
            </div>
          </div>

          {expandedCall === call.id && (
            <div style={{ padding: "0 var(--space-5) var(--space-5)", borderTop: "1px solid var(--color-border)", background: "var(--color-bg)" }}>
              <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: "280px", overflowY: "auto" }}>
                {call.transcript.map((msg, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "70%", padding: "var(--space-2) var(--space-3)", borderRadius: msg.role === "user" ? "var(--radius-lg) 4px var(--radius-lg) var(--radius-lg)" : "4px var(--radius-lg) var(--radius-lg) var(--radius-lg)", background: msg.role === "user" ? "var(--color-brand)" : "var(--color-bg-subtle)", border: msg.role === "user" ? "none" : "1px solid var(--color-border)", color: msg.role === "user" ? "#fff" : "var(--color-text-primary)", fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
