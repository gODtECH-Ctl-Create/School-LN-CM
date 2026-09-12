"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void router.prefetch("/");
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setLoading(false);
      setError("We couldn't sign you in. Check your email and password and try again.");
      return;
    }

    router.replace("/");
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">SL</div>
        <p className="eyebrow">SCHOOL LN CM</p>
        <h1 id="login-title">Welcome back.</h1>
        <p className="muted">Sign in to continue to your school's teaching and curriculum workspace.</p>

        <form onSubmit={handleSubmit} className="login-form" aria-busy={loading}>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              required
              disabled={loading}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>

          {error && <p className="error" role="alert">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-helper">
          <span>New teacher?</span>
          <strong>Your school administrator sends your invitation by email.</strong>
        </div>

        <p className="login-note">
          Setting up a new school? <Link href="/signup">Create a school account.</Link>
        </p>

        <p className="login-note">Your Staff ID is part of your school record. It is not your login credential.</p>
      </section>

      {loading && (
        <div className="auth-loading" role="status" aria-live="polite">
          <div className="auth-loading-card">
            <span className="auth-loading-spinner" aria-hidden="true" />
            <div><strong>Signing you in</strong><span>Opening your school workspace…</span></div>
          </div>
        </div>
      )}
    </main>
  );
}
