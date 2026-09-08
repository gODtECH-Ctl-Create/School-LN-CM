"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);
    if (signInError) {
      setError("Invalid email or password. Check your details and try again.");
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
        <p className="muted">Sign in with the email address registered for your school account.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
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

        <p className="login-note">Teachers receive their account by email invitation. Your Staff ID remains a school record identifier, not a login credential.</p>
      </section>
    </main>
  );
}
