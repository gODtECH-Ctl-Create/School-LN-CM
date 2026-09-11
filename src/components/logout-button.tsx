"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="logout-button"
        onClick={() => setOpen(true)}
      >
        Log out
      </button>

      {open && (
        <div className="logout-modal-backdrop" role="presentation" onClick={() => !loading && setOpen(false)}>
          <div
            className="logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">ACCOUNT</p>
            <h2 id="logout-title">Log out?</h2>
            <p id="logout-description" className="muted">
              Are you sure you want to log out of School LN CM?
            </p>
            <div className="logout-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void handleLogout()} disabled={loading}>
                {loading ? "Logging out…" : "Yes, log out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
