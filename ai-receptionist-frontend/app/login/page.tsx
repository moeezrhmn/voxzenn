"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-8)" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "24px" }}>📞</span>
            <span style={{ fontWeight: "var(--font-bold)", fontSize: "var(--text-xl)", color: "var(--color-text-primary)" }}>Voxzenn</span>
          </Link>
          <p style={{ marginTop: "var(--space-2)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
            Sign in to your account
          </p>
        </div>

        <div className="card" style={{ padding: "var(--space-8)" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div className="form-group">
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && (
              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "var(--space-6)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
          Don't have an account?{" "}
          <Link href="/signup" style={{ color: "var(--color-brand)", textDecoration: "none", fontWeight: "var(--font-medium)" }}>Sign up free</Link>
        </p>

        {/* Demo accounts */}
        <div style={{ marginTop: "var(--space-8)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-6)" }}>
          <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Try a demo
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {[
              { label: "💇 Glamour Hair Studio", email: "demo-glamour@voxzenn.demo" },
              { label: "💅 Luxe Nail Bar", email: "demo-luxe@voxzenn.demo" },
            ].map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => { setEmail(demo.email); setPassword("VoxDemo2026!"); }}
                style={{
                  width: "100%",
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--color-bg-subtle)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-text-secondary)",
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "border-color var(--transition-fast)",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--color-brand)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
              >
                <span>{demo.label}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Use demo →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
