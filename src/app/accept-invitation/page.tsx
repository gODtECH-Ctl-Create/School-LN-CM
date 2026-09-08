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

    setMessage("Account ready. Taking you to your teacher workspace...");
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">SL</div>
        <p className="eyebrow">SCHOOL LN CM</p>
        <h1>Welcome to the team.</h1>
        <p className="muted">
          Complete your Future Speakers International School account and create your password.
        </p>

        {ready && email && (
          <div className="invite-email">
            <span>Invited email</span>
            <strong>{email}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
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

          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}

          <button type="submit" disabled={loading || !ready || !email}>
            {loading ? "Finishing setup..." : "Complete account"}
          </button>
        </form>

        <p className="login-note">
          Your Staff ID remains part of your school record. You will sign in with your email from now on.
        </p>
      </section>
    </main>
  );
}
