"use client";

import { useEffect } from "react";

export default function AcademicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Academic Setup render error", error);
  }, [error]);

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="academic-error-title">
        <div className="brand-mark" aria-hidden="true">SL</div>
        <p className="eyebrow">ACADEMIC SETUP</p>
        <h1 id="academic-error-title">We couldn't load School Setup.</h1>
        <p className="muted">The navigation is still working, but this screen hit a browser error. Retry once; if it happens again, the error details are now captured for diagnosis.</p>
        {error.message && <p className="login-note">Error: {error.message}</p>}
        <button className="btn btn-primary" type="button" onClick={() => reset()}>Retry</button>
      </section>
    </main>
  );
}
