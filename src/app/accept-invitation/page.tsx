"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.email) {
        setEmail(data.session.user.email);
        setReady(true);
        return;
      }

      setError("This invitation link is no longer active. Open the invitation email again or ask your administrator for a new invitation.");
      setReady(true);
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: passwordError } = await supabase.auth.updateUser({ password });

    if (passwordError) {
      setLoading(false);
      setError(passwordError.message);
      return;
    }

    const response = await fetch("/api/auth/accept-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setLoading(false);
      setError(result.error ?? "Unable to activate your account.");
      return;
    }

    setMessage("Account ready. Taking you to your teacher workspace…");
    router.replace("/");
    router.refresh();
  }

  const blocked = ready && !email;

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="invite-title">
        <div className="brand-mark" aria-hidden="true">SL</div>
        <p className="eyebrow">WELCOME TO SCHOOL LN CM</p>
        <h1 id="invite-title">Set up your account.</h1>
        <p className="muted">You’ve been invited by Future Speakers International School. Create your password to activate your teacher workspace.</p>

        {!blocked && email && (
          <div className="invite-email">
            <span>Invited email</span>
            <strong>{email}</strong>
          </div>
        )}

        {blocked ? (
          <div className="empty-state" style={{ marginTop: 22 }}>
            <strong>This invitation needs attention.</strong>
            <p style={{ margin: "7px 0 0" }}>Open the original invitation email again, or ask your school administrator to send a new invitation.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Create password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus
                required
                disabled={!ready || !email}
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
                disabled={!ready || !email}
              />
            </label>

            {error && <p className="error" role="alert">{error}</p>}
            {message && <p className="success" role="status">{message}</p>}

            <button type="submit" disabled={loading || !ready || !email}>
              {loading ? "Finishing setup…" : "Complete account"}
            </button>
          </form>
        )}

        <p className="login-note">Your Staff ID remains part of your school record. You’ll use your email address to sign in after activation.</p>
      </section>
    </main>
  );
}
