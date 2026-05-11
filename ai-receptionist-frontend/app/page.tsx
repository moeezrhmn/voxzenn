import Link from "next/link";
import {
  Mic, Calendar, Zap, Settings2, FileText, Globe,
  Phone, ArrowRight,
} from "lucide-react";
import DemoTranscript from "@/components/DemoTranscript";
import NavAuthButtons from "@/components/NavAuthButtons";

const features = [
  {
    icon: Mic,
    title: "Natural Voice Conversations",
    desc: "Callers speak naturally — AI understands intent, responds in context, and keeps the conversation flowing.",
    color: "#7c6ff7",
  },
  {
    icon: Calendar,
    title: "Automatic Appointment Booking",
    desc: "AI collects name, phone, and preferred time — saves the booking instantly to your dashboard.",
    color: "#34d399",
  },
  {
    icon: Zap,
    title: "Instant Response, 24/7",
    desc: "No missed calls, no hold music. Every caller gets a response in under 2 seconds, any hour of the day.",
    color: "#fbbf24",
  },
  {
    icon: Settings2,
    title: "Set Up in 5 Minutes",
    desc: "Enter your business details, FAQs, and hours. Your AI receptionist is live immediately — no code needed.",
    color: "#60a5fa",
  },
  {
    icon: FileText,
    title: "Call Logs & Transcripts",
    desc: "Every call is logged. Read full transcripts, review bookings, and see exactly what callers asked.",
    color: "#f472b6",
  },
  {
    icon: Globe,
    title: "Works for Any Business",
    desc: "Salons, clinics, law firms, gyms, plumbers — any business that takes calls and books appointments.",
    color: "#2dd4bf",
  },
];

const steps = [
  {
    step: "01",
    title: "Create your account",
    desc: "Sign up free — no credit card required. Takes 30 seconds.",
  },
  {
    step: "02",
    title: "Set up your business",
    desc: "Add your business name, hours, FAQs, and the personality you want your AI to have.",
  },
  {
    step: "03",
    title: "Test your AI",
    desc: "Make a live test call directly in the browser before going live with real customers.",
  },
  {
    step: "04",
    title: "Go live",
    desc: "Share your call link or connect your phone number. Your AI answers every call from this point on.",
  },
];

const industries = ["Dental Clinics", "Law Firms", "Hair Salons", "Gyms", "Plumbers", "Medical Practices", "Auto Repair", "Accountants"];

export default function LandingPage() {
  return (
    <div style={{ background: "var(--color-bg)", overflowX: "hidden" }}>

      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--color-border)",
        padding: "0 var(--space-8)",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(10, 10, 15, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Phone size={18} color="var(--color-brand)" />
          <span style={{ fontWeight: "var(--font-bold)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            Voxzenn
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-success)", boxShadow: "0 0 6px var(--color-success)" }} />
          All systems operational
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <NavAuthButtons />
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        padding: "100px var(--space-8) 80px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}>
        {/* Glow behind hero */}
        <div style={{
          position: "absolute",
          top: "60px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          background: "radial-gradient(ellipse at center, rgba(124, 111, 247, 0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }} />

        <div className="hero-grid" style={{ position: "relative", zIndex: 1 }}>
          {/* Left */}
          <div>
            <div className="badge badge-blue" style={{ marginBottom: "var(--space-5)" }}>
              AI Voice Receptionist
            </div>

            <h1 style={{
              fontSize: "clamp(2.4rem, 5vw, 4rem)",
              fontWeight: "var(--font-extrabold)",
              lineHeight: 1.08,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.03em",
              marginBottom: "var(--space-5)",
            }}>
              Your business<br />
              never misses<br />
              <span className="gradient-text">a call again.</span>
            </h1>

            <p style={{
              fontSize: "var(--text-lg)",
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-8)",
              lineHeight: 1.7,
              maxWidth: "440px",
            }}>
              Voxzenn answers calls, books appointments, and handles FAQs —
              24/7, in under 2 seconds. No hiring, no hold music.
            </p>

            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-8)" }}>
              <Link href="/signup" className="btn btn-primary btn-lg" style={{ gap: "var(--space-2)" }}>
                Start for Free <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn btn-outline btn-lg">
                Sign In
              </Link>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
              {[
                { value: "10,000+", label: "calls answered" },
                { value: "< 2s", label: "response time" },
                { value: "24/7", label: "always on" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)", color: "var(--color-text-primary)" }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "2px" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — animated transcript */}
          <div className="hero-transcript">
            <DemoTranscript />
          </div>
        </div>
      </section>

      {/* Industry strip */}
      <div style={{
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        padding: "var(--space-5) var(--space-8)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-6)",
        overflowX: "auto",
        background: "var(--color-bg-card)",
      }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
          Used across 12+ industries
        </span>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          {industries.map((name) => (
            <span key={name} style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-secondary)",
              background: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-full)",
              padding: "3px var(--space-3)",
              whiteSpace: "nowrap",
            }}>
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section style={{ padding: "100px var(--space-8)", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ maxWidth: "520px", marginBottom: "var(--space-12)" }}>
          <h2 style={{
            fontSize: "var(--text-4xl)",
            fontWeight: "var(--font-extrabold)",
            color: "var(--color-text-primary)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginBottom: "var(--space-4)",
          }}>
            Everything your<br />
            <span className="gradient-text">receptionist does.</span>
          </h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-lg)", lineHeight: 1.7 }}>
            Without the salary, sick days, or hold music.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "var(--space-4)",
        }}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card" style={{
                padding: "var(--space-6)",
                borderTop: `2px solid ${f.color}`,
              }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "var(--radius-md)",
                  background: `${f.color}18`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--space-4)",
                }}>
                  <Icon size={18} color={f.color} />
                </div>
                <h3 style={{
                  fontWeight: "var(--font-semibold)",
                  marginBottom: "var(--space-2)",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--text-base)",
                }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section style={{
        borderTop: "1px solid var(--color-border)",
        padding: "100px var(--space-8)",
        background: "var(--color-bg-card)",
      }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ marginBottom: "var(--space-12)" }}>
            <h2 style={{
              fontSize: "var(--text-4xl)",
              fontWeight: "var(--font-extrabold)",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: "var(--space-4)",
            }}>
              Up and running<br />
              <span className="gradient-text">in minutes.</span>
            </h2>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-lg)" }}>
              No technical knowledge required.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {steps.map((s, i) => (
              <div key={s.step} style={{
                display: "flex",
                gap: "var(--space-8)",
                paddingBottom: i < steps.length - 1 ? "var(--space-10)" : "0",
                position: "relative",
              }}>
                {/* Timeline line */}
                {i < steps.length - 1 && (
                  <div style={{
                    position: "absolute",
                    left: "23px",
                    top: "48px",
                    bottom: "0",
                    width: "1px",
                    background: "linear-gradient(to bottom, var(--color-brand), transparent)",
                  }} />
                )}

                {/* Step number */}
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--color-brand-light)",
                  border: "1px solid rgba(124, 111, 247, 0.3)",
                  color: "var(--color-brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-bold)",
                  fontSize: "var(--text-xs)",
                  flexShrink: 0,
                  position: "relative",
                  zIndex: 1,
                }}>
                  {s.step}
                </div>

                <div style={{ paddingTop: "var(--space-2)" }}>
                  <h3 style={{
                    fontWeight: "var(--font-semibold)",
                    color: "var(--color-text-primary)",
                    marginBottom: "var(--space-2)",
                    fontSize: "var(--text-lg)",
                  }}>
                    {s.title}
                  </h3>
                  <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        borderTop: "1px solid var(--color-border)",
        padding: "100px var(--space-8)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        background: "var(--color-bg-card)",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "300px",
          background: "radial-gradient(ellipse at center, rgba(124, 111, 247, 0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: "var(--font-extrabold)",
            color: "var(--color-text-primary)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginBottom: "var(--space-4)",
          }}>
            Ready to never miss<br />
            <span className="gradient-text">a call again?</span>
          </h2>
          <p style={{
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-8)",
            fontSize: "var(--text-lg)",
            maxWidth: "440px",
            margin: "0 auto var(--space-8)",
          }}>
            Set up your AI receptionist in 5 minutes. Free to start, no credit card needed.
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              Get Started Free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--color-border)",
        padding: "var(--space-10) var(--space-8)",
        background: "var(--color-bg)",
      }}>
        <div style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: "var(--space-8)",
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <Phone size={16} color="var(--color-brand)" />
              <span style={{ fontWeight: "var(--font-bold)", color: "var(--color-text-primary)" }}>Voxzenn</span>
            </div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", lineHeight: 1.7, maxWidth: "240px" }}>
              AI voice receptionist for small businesses. Answers calls, books appointments, handles FAQs.
            </p>
          </div>

          {[
            { heading: "Product", links: [{ label: "Dashboard", href: "/dashboard" }] },
            { heading: "Account", links: [{ label: "Sign Up", href: "/signup" }, { label: "Log In", href: "/login" }] },
            { heading: "Company", links: [{ label: "About", href: "#" }, { label: "Contact", href: "#" }] },
          ].map((col) => (
            <div key={col.heading}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-semibold)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "var(--space-4)" }}>
                {col.heading}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {col.links.map((link) => (
                  <Link key={link.label} href={link.href} style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                    transition: "color var(--transition-fast)",
                  }}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          maxWidth: "1100px",
          margin: "var(--space-8) auto 0",
          paddingTop: "var(--space-6)",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            © 2026 Voxzenn. Built with AI.
          </p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            Privacy · Terms
          </p>
        </div>
      </footer>

    </div>
  );
}
