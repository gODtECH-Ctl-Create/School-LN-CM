"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

function staffLoginEmail(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) return value;
  return `${value.toLowerCase()}@staff.school-ln-cm.local`;
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: staffLoginEmail(identifier),
      password,
    });

    setLoading(false);
    if (signInError) {
      setError("Invalid login details. Check your Staff ID or email and password.");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">SL</div>
        <p className="eyebrow">SCHOOL LN CM</p>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in with your school staff ID or administrator email.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Staff ID or Admin Email
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="FSIS-T-0001 or admin@example.com"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="login-note">Teachers use their school-issued Staff ID. School administrators use their registered email.</p>
      </section>
    </main>
  );
}
