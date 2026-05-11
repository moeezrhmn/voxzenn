"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create account.");
      setLoading(false);
      return;
    }

    // Auto sign-in after signup
    await signIn("credentials", { email, password, redirect: false });
    router.push("/onboarding");
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
            Create your free account
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
              <input id="password" type="password" className="input" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="confirm">Confirm password</label>
              <input id="confirm" type="password" className="input" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            {error && (
              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: "var(--text-sm)" }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
              {loading ? "Creating account..." : "Create account"}
            </button>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textAlign: "center" }}>
              No credit card required · Free to start
            </p>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: "var(--space-6)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--color-brand)", textDecoration: "none", fontWeight: "var(--font-medium)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
