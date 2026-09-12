"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

function getPublicSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return configured || window.location.origin;
}

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void router.prefetch("/onboarding");
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${getPublicSiteUrl()}/auth/callback?next=/onboarding`,
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.replace("/onboarding");
      return;
    }

    setNotice("Check your email to confirm your account. Then you will continue to school setup.");
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="signup-title">
        <div className="brand-mark" aria-hidden="true">SL</div>
        <p className="eyebrow">NEW SCHOOL</p>
        <h1 id="signup-title">Create your school account.</h1>
        <p className="muted">One account becomes your school administrator. After sign-up, we’ll confirm your email and then take you through school setup.</p>

        <form onSubmit={handleSubmit} className="login-form" aria-busy={loading}>
          <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" autoFocus required disabled={loading} /></label>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={loading} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required disabled={loading} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          {notice && <p className="success" role="status">{notice}</p>}
          <button type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
        </form>

        <p className="login-note"><Link href="/login">Already have an account? Sign in.</Link></p>
      </section>

      {loading && (
        <div className="auth-loading" role="status" aria-live="polite">
          <div className="auth-loading-card">
            <span className="auth-loading-spinner" aria-hidden="true" />
            <div><strong>Creating your account</strong><span>Preparing your school setup…</span></div>
          </div>
        </div>
      )}
    </main>
  );
}
