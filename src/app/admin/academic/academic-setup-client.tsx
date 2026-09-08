"use client";

import { FormEvent, useMemo, useState } from "react";

export type AcademicData = {
  schools: { id: string; name: string; code: string }[];
  school: { id: string; name: string; code: string };
  sessions: { id: string; name: string; starts_on: string; ends_on: string; is_current: boolean }[];
  terms: { id: string; academic_session_id: string; name: string; term_number: number; starts_on: string; ends_on: string; is_current: boolean }[];
  classes: { id: string; name: string; level: string | null }[];
  subjects: { id: string; name: string; code: string | null }[];
};

type SessionForm = { id?: string; name: string; startsOn: string; endsOn: string; isCurrent: boolean };
type TermForm = { id?: string; sessionId: string; name: string; termNumber: number; startsOn: string; endsOn: string; isCurrent: boolean };

type SimpleForm = { id?: string; name: string; code?: string; level?: string };

const emptySession: SessionForm = { name: "2026 / 2027", startsOn: "2026-09-01", endsOn: "2027-07-31", isCurrent: true };
const emptyTerm: TermForm = { sessionId: "", name: "First Term", termNumber: 1, startsOn: "2026-09-01", endsOn: "2026-12-18", isCurrent: true };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default function AcademicSetupClient({ initialData }: { initialData: AcademicData }) {
  const [data, setData] = useState(initialData);
  const [sessionForm, setSessionForm] = useState<SessionForm>(emptySession);
  const [termForm, setTermForm] = useState<TermForm>({ ...emptyTerm, sessionId: initialData.sessions[0]?.id ?? "" });
  const [classForm, setClassForm] = useState<SimpleForm>({ name: "" });
  const [subjectForm, setSubjectForm] = useState<SimpleForm>({ name: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentSession = data.sessions.find((item) => item.is_current) ?? data.sessions[0];
  const currentTerms = useMemo(
    () => data.sessions.flatMap((session) => data.terms.filter((term) => term.academic_session_id === session.id).map((term) => ({ ...term, sessionName: session.name }))),
    [data.sessions, data.terms],
  );

  function resetMessages() {
    setError("");
    setNotice("");
  }

  async function submit(action: string, body: Record<string, unknown>, success: string) {
    resetMessages();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, schoolId: data.school.id, ...body }),
      });
      const result = (await response.json()) as AcademicData & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save academic setup.");
        return false;
      }
      setData((current) => ({ ...current, sessions: result.sessions, terms: result.terms, classes: result.classes, subjects: result.subjects }));
      setNotice(success);
      return true;
    } catch {
      setError("We couldn't reach the academic setup service. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submit(sessionForm.id ? "update_session" : "create_session", { sessionId: sessionForm.id, name: sessionForm.name, startsOn: sessionForm.startsOn, endsOn: sessionForm.endsOn, isCurrent: sessionForm.isCurrent }, sessionForm.id ? "Academic session updated." : "Academic session created.");
    if (ok) setSessionForm({ ...emptySession });
  }

  async function saveTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submit(termForm.id ? "update_term" : "create_term", { termId: termForm.id, sessionId: termForm.sessionId, name: termForm.name, termNumber: termForm.termNumber, startsOn: termForm.startsOn, endsOn: termForm.endsOn, isCurrent: termForm.isCurrent }, termForm.id ? "Term updated." : "Term created.");
    if (ok) setTermForm({ ...emptyTerm, sessionId: currentSession?.id ?? data.sessions[0]?.id ?? "" });
  }

  async function saveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submit(classForm.id ? "update_class" : "create_class", { classId: classForm.id, name: classForm.name, level: classForm.level }, classForm.id ? "Class updated." : "Class added.");
    if (ok) setClassForm({ name: "" });
  }

  async function saveSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await submit(subjectForm.id ? "update_subject" : "create_subject", { subjectId: subjectForm.id, name: subjectForm.name, code: subjectForm.code }, subjectForm.id ? "Subject updated." : "Subject added.");
    if (ok) setSubjectForm({ name: "" });
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">ACADEMIC SETUP</p>
          <h1>Build the school calendar.</h1>
          <p className="muted">Set the academic session, terms, classes and subjects that give every lesson a clear school context.</p>
          <div className="context-strip">
            <span className="context-chip"><strong>{data.school.code}</strong> {data.school.name}</span>
            <span className="context-chip">Current session <strong>{currentSession?.name ?? "Not configured"}</strong></span>
          </div>
        </div>
        <span className="live-indicator"><span aria-hidden="true" /> Academic foundation</span>
      </section>

      {(error || notice) && (
        <div className={error ? "form-alert form-alert-error" : "form-alert form-alert-success"} role={error ? "alert" : "status"}>{error || notice}</div>
      )}

      <section className="academic-overview grid-3" aria-label="Academic setup summary">
        <article className="surface stat-card"><span className="stat-label">Sessions</span><div className="stat-value">{data.sessions.length}</div><div className="stat-note">Academic years available to the school.</div></article>
        <article className="surface stat-card"><span className="stat-label">Terms</span><div className="stat-value">{data.terms.length}</div><div className="stat-note">Terms configured across academic sessions.</div></article>
        <article className="surface stat-card"><span className="stat-label">Teaching structure</span><div className="stat-value">{data.classes.length + data.subjects.length}</div><div className="stat-note">Classes and subjects ready for assignment.</div></article>
      </section>

      <div className="academic-grid">
        <section className="surface section-card">
          <div className="section-heading"><div><h2>Academic sessions</h2><p>Define the school year and identify the active session.</p></div><span className="count-badge">{data.sessions.length}</span></div>
          <div className="data-list">
            {data.sessions.length ? data.sessions.map((session) => (
              <article className="data-row" key={session.id}>
                <div><strong>{session.name}</strong><p>{formatDate(session.starts_on)} – {formatDate(session.ends_on)}</p></div>
                <div className="row-actions"><span className={session.is_current ? "status status-accepted" : "status status-provisioning"}>{session.is_current ? "Current" : "Inactive"}</span><button className="button-secondary" type="button" onClick={() => setSessionForm({ id: session.id, name: session.name, startsOn: session.starts_on, endsOn: session.ends_on, isCurrent: session.is_current })}>Edit</button></div>
              </article>
            )) : <div className="empty-state"><strong>No academic session yet.</strong><p>Start by creating the school's current academic year.</p></div>}
          </div>
          <form className="inline-create" onSubmit={saveSession}>
            <div className="section-subheading"><strong>{sessionForm.id ? "Edit session" : "Add session"}</strong><button className="text-button" type="button" onClick={() => setSessionForm({ ...emptySession })}>Reset</button></div>
            <div className="form-grid"><label className="field">Session name<input value={sessionForm.name} onChange={(event) => setSessionForm({ ...sessionForm, name: event.target.value })} placeholder="2026 / 2027" required /></label><label className="field">Starts<input type="date" value={sessionForm.startsOn} onChange={(event) => setSessionForm({ ...sessionForm, startsOn: event.target.value })} required /></label><label className="field">Ends<input type="date" value={sessionForm.endsOn} onChange={(event) => setSessionForm({ ...sessionForm, endsOn: event.target.value })} required /></label></div>
            <label className="check-field"><input type="checkbox" checked={sessionForm.isCurrent} onChange={(event) => setSessionForm({ ...sessionForm, isCurrent: event.target.checked })} /> Mark as the current session</label>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : sessionForm.id ? "Save session" : "Create session"}</button>
          </form>
        </section>

        <section className="surface section-card">
          <div className="section-heading"><div><h2>Terms</h2><p>Set the three-term structure and identify the current teaching period.</p></div><span className="count-badge">{data.terms.length}</span></div>
          <div className="data-list">
            {currentTerms.length ? currentTerms.map((term) => (
              <article className="data-row" key={term.id}><div><strong>{term.name}</strong><p>{term.sessionName} · {formatDate(term.starts_on)} – {formatDate(term.ends_on)}</p></div><div className="row-actions"><span className={term.is_current ? "status status-accepted" : "status status-provisioning"}>{term.is_current ? "Current" : `Term ${term.term_number}`}</span><button className="button-secondary" type="button" onClick={() => setTermForm({ id: term.id, sessionId: term.academic_session_id, name: term.name, termNumber: term.term_number, startsOn: term.starts_on, endsOn: term.ends_on, isCurrent: term.is_current })}>Edit</button></div></article>
            )) : <div className="empty-state"><strong>No terms yet.</strong><p>Once a session exists, add First Term, Second Term and Third Term here.</p></div>}
          </div>
          <form className="inline-create" onSubmit={saveTerm}>
            <div className="section-subheading"><strong>{termForm.id ? "Edit term" : "Add term"}</strong><button className="text-button" type="button" onClick={() => setTermForm({ ...emptyTerm, sessionId: currentSession?.id ?? data.sessions[0]?.id ?? "" })}>Reset</button></div>
            <div className="form-grid"><label className="field">Academic session<select value={termForm.sessionId} onChange={(event) => setTermForm({ ...termForm, sessionId: event.target.value })} required><option value="">Select session</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label><label className="field">Term<select value={termForm.termNumber} onChange={(event) => setTermForm({ ...termForm, termNumber: Number(event.target.value) })}><option value={1}>First Term</option><option value={2}>Second Term</option><option value={3}>Third Term</option></select></label><label className="field">Term name<input value={termForm.name} onChange={(event) => setTermForm({ ...termForm, name: event.target.value })} placeholder="First Term" required /></label><label className="field">Starts<input type="date" value={termForm.startsOn} onChange={(event) => setTermForm({ ...termForm, startsOn: event.target.value })} required /></label><label className="field">Ends<input type="date" value={termForm.endsOn} onChange={(event) => setTermForm({ ...termForm, endsOn: event.target.value })} required /></label></div>
            <label className="check-field"><input type="checkbox" checked={termForm.isCurrent} onChange={(event) => setTermForm({ ...termForm, isCurrent: event.target.checked })} /> Mark as the current term</label>
            <button className="btn btn-primary" type="submit" disabled={saving || !termForm.sessionId}>{saving ? "Saving…" : termForm.id ? "Save term" : "Create term"}</button>
          </form>
        </section>
      </div>

      <div className="academic-grid academic-grid-lower">
        <section className="surface section-card">
          <div className="section-heading"><div><h2>Classes</h2><p>Keep the class list clean and reusable for teacher assignments.</p></div><span className="count-badge">{data.classes.length}</span></div>
          <div className="data-list compact-list">{data.classes.length ? data.classes.map((item) => <article className="data-row" key={item.id}><div><strong>{item.name}</strong><p>{item.level || "Level not set"}</p></div><button className="button-secondary" type="button" onClick={() => setClassForm({ id: item.id, name: item.name, level: item.level ?? "" })}>Edit</button></article>) : <div className="empty-state"><strong>No classes yet.</strong><p>Add Primary 5, Primary 6 and other teaching groups.</p></div>}</div>
          <form className="inline-create" onSubmit={saveClass}><div className="section-subheading"><strong>{classForm.id ? "Edit class" : "Add class"}</strong><button className="text-button" type="button" onClick={() => setClassForm({ name: "" })}>Reset</button></div><div className="form-grid"><label className="field">Class name<input value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} placeholder="Primary 5" required /></label><label className="field">Level / group<input value={classForm.level ?? ""} onChange={(event) => setClassForm({ ...classForm, level: event.target.value })} placeholder="Primary" /></label></div><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : classForm.id ? "Save class" : "Add class"}</button></form>
        </section>

        <section className="surface section-card">
          <div className="section-heading"><div><h2>Subjects</h2><p>Create the subject vocabulary used throughout curriculum and lessons.</p></div><span className="count-badge">{data.subjects.length}</span></div>
          <div className="data-list compact-list">{data.subjects.length ? data.subjects.map((item) => <article className="data-row" key={item.id}><div><strong>{item.name}</strong><p>{item.code || "No subject code"}</p></div><button className="button-secondary" type="button" onClick={() => setSubjectForm({ id: item.id, name: item.name, code: item.code ?? "" })}>Edit</button></article>) : <div className="empty-state"><strong>No subjects yet.</strong><p>Add Mathematics, Basic Science and the other subjects your school teaches.</p></div>}</div>
          <form className="inline-create" onSubmit={saveSubject}><div className="section-subheading"><strong>{subjectForm.id ? "Edit subject" : "Add subject"}</strong><button className="text-button" type="button" onClick={() => setSubjectForm({ name: "" })}>Reset</button></div><div className="form-grid"><label className="field">Subject name<input value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} placeholder="Mathematics" required /></label><label className="field">Code<input value={subjectForm.code ?? ""} onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })} placeholder="MATH" /></label></div><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : subjectForm.id ? "Save subject" : "Add subject"}</button></form>
        </section>
      </div>
    </>
  );
}
