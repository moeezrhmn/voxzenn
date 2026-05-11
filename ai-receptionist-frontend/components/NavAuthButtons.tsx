"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function NavAuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div style={{ width: "160px" }} />;

  if (session) {
    return (
      <Link href="/dashboard" className="btn btn-primary">
        Dashboard →
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <Link href="/login" className="btn btn-ghost">Log in</Link>
      <Link href="/signup" className="btn btn-primary">Get Started Free</Link>
    </div>
  );
}
