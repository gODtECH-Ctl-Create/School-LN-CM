"use client";

import { FormEvent, useMemo, useState } from "react";
import StructureSetupClient from "./structure-setup-client";

export type AcademicDataV3 = {
  school: { id: string; name: string; code: string; capabilities?: string[] | null };
  sessions: { id: string; name: string; starts_on: string; ends_on: string; is_current: boolean }[];
  terms: { id: string; academic_session_id: string; name: string; term_number: number; starts_on: string; ends_on: string; is_current: boolean }[];
  classes: { id: string; name: string; level: string | null }[];
  subjects: { id: string; name: string; code: string | null }[];
};

type SessionForm = { id?: string; name: string; startsOn: string; endsOn: string; isCurrent: boolean };
type TermForm = { id?: string; sessionId: string; name: string; termNumber: number; startsOn: string; endsOn: string; isCurrent: boolean };

function formatDate(value: string) { return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }

export default function AcademicSetupV3({ initialData, structureData }: { initialData: AcademicDataV3; structureData: React.ComponentProps<typeof StructureSetupClient>["initialData"] }) {
  const [data, setData] = useState(initialData);
  const [sessionForm, setSessionForm] = useState<SessionForm>({ name: "2026 / 2027", startsOn: "2026-09-01", endsOn: "2027-07-31", isCurrent: true });
  const [termForm, setTermForm] = useState<TermForm>({ sessionId: initialData.sessions[0]?.id ?? "", name: "First Term", termNumber: 1, startsOn: "2026-09-01", endsOn: "2026-12-18", isCurrent: true });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentSession = data.sessions.find((item) => item.is_current) ?? data.sessions[0];
  const currentTerms = useMemo(() => data.sessions.flatMap((session) => data.terms.filter((term) => term.academic_session_id === session.id).map((term) => ({ ...term, sessionName: session.name }))), [data.sessions, data.terms]);

  async function submit(action: string, body: Record<string, unknown>, success: string) {
    setError(""); setMessage(""); setSaving(true);
    try {
      const response = await fetch("/api/admin/academic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, schoolId: data.school.id, ...body }) });
      const result = (await response.json()) as { error?: string; school?: AcademicDataV3["school"]; sessions: AcademicDataV3["sessions"]; terms: AcademicDataV3["terms"]; classes: AcademicDataV3["classes"]; subjects: AcademicDataV3["subjects"] };
      if (!response.ok) { setError(result.error ?? "Unable to save academic setup."); return false; }
      setData((current) => ({ ...current, school: result.school ?? current.school, sessions: result.sessions, terms: result.terms, classes: result.classes, subjects: result.subjects }));
      setMessage(success); return true;
    } catch { setError("We couldn't reach academic setup. Try again."); return false; }
    finally { setSaving(false); }
  }

  async function saveSession(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const ok = await submit(sessionForm.id ? "update_session" : "create_session", { sessionId: sessionForm.id, name: sessionForm.name, startsOn: sessionForm.startsOn, endsOn: sessionForm.endsOn, isCurrent: sessionForm.isCurrent }, sessionForm.id ? "Academic session updated." : "Academic session created."); if (ok) setSessionForm((current) => ({ ...current, id: undefined })); }
  async function saveTerm(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const ok = await submit(termForm.id ? "update_term" : "create_term", { termId: termForm.id, sessionId: termForm.sessionId, name: termForm.name, termNumber: termForm.termNumber, startsOn: termForm.startsOn, endsOn: termForm.endsOn, isCurrent: termForm.isCurrent }, termForm.id ? "Term updated." : "Term created."); if (ok) setTermForm((current) => ({ ...current, id: undefined })); }

  return (
    <div className="academic-v3">
      <section className="page-heading"><div><p className="eyebrow">ACADEMIC SETUP</p><h1>Set up the school structure.</h1><p className="muted">Session and term define time. Classes and subjects are configured separately for each school level.</p><div className="context-strip"><span className="context-chip"><strong>{data.school.code}</strong> {data.school.name}</span><span className="context-chip">Current session <strong>{currentSession?.name ?? "Not configured"}</strong></span></div></div></section>
      {(error || message) && <div className={error ? "form-alert form-alert-error" : "form-alert form-alert-success"} role={error ? "alert" : "status"}>{error || message}</div>}

      <section className="academic-v3-grid">
        <section className="surface section-card"><div className="section-heading"><div><h2>Academic sessions</h2><p>Define the school year and identify the active session.</p></div><span className="count-badge">{data.sessions.length}</span></div><div className="data-list">{data.sessions.map((session) => <article className="data-row" key={session.id}><div><strong>{session.name}</strong><p>{formatDate(session.starts_on)} – {formatDate(session.ends_on)}</p></div><div className="row-actions"><span className={session.is_current ? "status status-accepted" : "status status-provisioning"}>{session.is_current ? "Current" : "Inactive"}</span><button className="button-secondary" type="button" onClick={() => setSessionForm({ id: session.id, name: session.name, startsOn: session.starts_on, endsOn: session.ends_on, isCurrent: session.is_current })}>Edit</button></div></article>)}</div><form className="inline-create" onSubmit={saveSession}><div className="section-subheading"><strong>{sessionForm.id ? "Edit session" : "Add session"}</strong><button type="button" className="text-button" onClick={() => setSessionForm({ name: "2026 / 2027", startsOn: "2026-09-01", endsOn: "2027-07-31", isCurrent: true })}>Reset</button></div><div className="form-grid"><label className="field">Session name<input value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} required /></label><label className="field">Starts<input type="date" value={sessionForm.startsOn} onChange={(e) => setSessionForm({ ...sessionForm, startsOn: e.target.value })} required /></label><label className="field">Ends<input type="date" value={sessionForm.endsOn} onChange={(e) => setSessionForm({ ...sessionForm, endsOn: e.target.value })} required /></label></div><label className="check-field"><input type="checkbox" checked={sessionForm.isCurrent} onChange={(e) => setSessionForm({ ...sessionForm, isCurrent: e.target.checked })} /> Make this the current session</label><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : sessionForm.id ? "Save session" : "Create session"}</button></form></section>

        <section className="surface section-card"><div className="section-heading"><div><h2>Terms</h2><p>Set the teaching period and identify the current term.</p></div><span className="count-badge">{data.terms.length}</span></div><div className="data-list">{currentTerms.map((term) => <article className="data-row" key={term.id}><div><strong>{term.name}</strong><p>{term.sessionName} · {formatDate(term.starts_on)} – {formatDate(term.ends_on)}</p></div><div className="row-actions"><span className={term.is_current ? "status status-accepted" : "status status-provisioning"}>{term.is_current ? "Current" : `Term ${term.term_number}`}</span><button className="button-secondary" type="button" onClick={() => setTermForm({ id: term.id, sessionId: term.academic_session_id, name: term.name, termNumber: term.term_number, startsOn: term.starts_on, endsOn: term.ends_on, isCurrent: term.is_current })}>Edit</button></div></article>)}</div><form className="inline-create" onSubmit={saveTerm}><div className="section-subheading"><strong>{termForm.id ? "Edit term" : "Add term"}</strong><button type="button" className="text-button" onClick={() => setTermForm({ sessionId: currentSession?.id ?? data.sessions[0]?.id ?? "", name: "First Term", termNumber: 1, startsOn: "2026-09-01", endsOn: "2026-12-18", isCurrent: true })}>Reset</button></div><div className="form-grid"><label className="field">Academic session<select value={termForm.sessionId} onChange={(e) => setTermForm({ ...termForm, sessionId: e.target.value })} required><option value="">Select session</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label><label className="field">Term<select value={termForm.termNumber} onChange={(e) => setTermForm({ ...termForm, termNumber: Number(e.target.value) })}><option value={1}>First Term</option><option value={2}>Second Term</option><option value={3}>Third Term</option></select></label><label className="field">Term name<input value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} required /></label><label className="field">Starts<input type="date" value={termForm.startsOn} onChange={(e) => setTermForm({ ...termForm, startsOn: e.target.value })} required /></label><label className="field">Ends<input type="date" value={termForm.endsOn} onChange={(e) => setTermForm({ ...termForm, endsOn: e.target.value })} required /></label></div><label className="check-field"><input type="checkbox" checked={termForm.isCurrent} onChange={(e) => setTermForm({ ...termForm, isCurrent: e.target.checked })} /> Make this the current term</label><button className="btn btn-primary" type="submit" disabled={saving || !termForm.sessionId}>{saving ? "Saving…" : termForm.id ? "Save term" : "Create term"}</button></form></section>
      </section>

      <StructureSetupClient schoolId={data.school.id} initialData={structureData} />
    </div>
  );
}
