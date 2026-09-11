"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCooldown(60);
    timerRef.current = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  async function sendCode() {
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
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }

    setVerificationSent(true);
    setNotice(`We sent a 6-digit verification code to ${normalizedEmail}.`);
    startCooldown();
  }

  async function verifyCode() {
    const token = code.replace(/\D/g, "").slice(0, 6);
    if (token.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "signup",
    });

    setLoading(false);
    if (verifyError) {
      setError("That code is invalid or has expired. Request a new code and try again.");
      return;
    }

    router.replace("/onboarding");
    router.refresh();
  }

  async function resendCode() {
    if (cooldown > 0 || resending) return;
    setError("");
    setNotice("");
    setResending(true);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });

    setResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }

    setCode("");
    setNotice(`A new verification code was sent to ${email.trim().toLowerCase()}.`);
    startCooldown();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verificationSent) {
      await verifyCode();
      return;
    }
    await sendCode();
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="signup-title">
        <div className="brand-mark" aria-hidden="true">SL</div>
        <p className="eyebrow">NEW SCHOOL</p>

        {!verificationSent ? (
          <>
            <h1 id="signup-title">Create your school account.</h1>
            <p className="muted">One account becomes your school administrator. We’ll verify your email with a code, then take you straight into school setup.</p>

            <form onSubmit={handleSubmit} className="login-form">
              <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" autoFocus required /></label>
              <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required /></label>
              {error && <p className="error" role="alert">{error}</p>}
              <button type="submit" disabled={loading}>{loading ? "Sending code…" : "Create account"}</button>
            </form>
          </>
        ) : (
          <>
            <h1 id="signup-title">Check your email.</h1>
            <p className="muted">Enter the 6-digit code we sent to <strong>{email.trim().toLowerCase()}</strong>. You’ll continue to school setup immediately after verification.</p>

            <form onSubmit={handleSubmit} className="login-form">
              <label>
                Verification code
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  style={{ textAlign: "center", letterSpacing: "0.36em", fontSize: 24, fontWeight: 850 }}
                  required
                />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              {notice && <p className="success" role="status">{notice}</p>}
              <button type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify email"}</button>
            </form>

            <div className="login-helper">
              <span>Didn’t receive the code?</span>
              <button type="button" className="text-button" onClick={() => void resendCode()} disabled={resending || cooldown > 0}>
                {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </>
        )}

        <p className="login-note"><Link href="/login">Already have an account? Sign in.</Link></p>
      </section>
    </main>
  );
}
