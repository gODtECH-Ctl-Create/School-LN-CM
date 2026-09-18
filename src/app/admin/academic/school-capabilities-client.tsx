"use client";

import { useState } from "react";
import { SCHOOL_CAPABILITIES } from "@/src/lib/school-capabilities";

type Props = { schoolId: string; initialCapabilities: string[] };

export default function SchoolCapabilitiesClient({ schoolId, initialCapabilities }: Props) {
  const [selected, setSelected] = useState<string[]>(initialCapabilities);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_school_capabilities", schoolId, capabilities: selected }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save school capabilities.");
        return;
      }
      setMessage("School capabilities updated.");
    } catch {
      setError("We couldn't reach School setup. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface section-card school-capabilities-card">
      <div className="section-heading">
        <div><h2>School capabilities</h2><p>Tell the platform which levels your school provides. This does not create classes.</p></div>
        <span className="count-badge">{selected.length} selected</span>
      </div>
      <div className="capability-grid">
        {SCHOOL_CAPABILITIES.map((item) => (
          <button type="button" key={item.id} className={`capability-option ${selected.includes(item.id) ? "is-selected" : ""}`} onClick={() => toggle(item.id)} aria-pressed={selected.includes(item.id)}>
            <span className="capability-check" aria-hidden="true">{selected.includes(item.id) ? "✓" : ""}</span>
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
          </button>
        ))}
      </div>
      {(error || message) && <div className={error ? "form-alert form-alert-error" : "form-alert form-alert-success"} role={error ? "alert" : "status"}>{error || message}</div>}
      <button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saving || selected.length === 0}>{saving ? "Saving…" : "Save capabilities"}</button>
    </section>
  );
}
