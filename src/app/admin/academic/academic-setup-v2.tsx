"use client";

import { FormEvent, useMemo, useState } from "react";
import { SCHOOL_CAPABILITIES, type SchoolCapability } from "@/src/lib/school-capabilities";

export type AcademicDataV2 = {
  schools: { id: string; name: string; code: string }[];
  school: { id: string; name: string; code: string; capabilities?: string[] | null };
  sessions: { id: string; name: string; starts_on: string; ends_on: string; is_current: boolean }[];
  terms: { id: string; academic_session_id: string; name: string; term_number: number; starts_on: string; ends_on: string; is_current: boolean }[];
  classes: { id: string; name: string; level: string | null }[];
  subjects: { id: string; name: string; code: string | null }[];
};

type SessionForm = { id?: string; name: string; startsOn: string; endsOn: string; isCurrent: boolean };
type TermForm = { id?: string; sessionId: string; name: string; termNumber: number; startsOn: string; endsOn: string; isCurrent: boolean };

type LevelId = SchoolCapability;

const CLASS_PRESETS: Record<LevelId, string[]> = {
  preschool: ["Preschool 1", "Preschool 2"],
  nursery: ["Nursery 1", "Nursery 2", "Nursery 3", "Nursery 4"],
  primary: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  secondary: ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"],
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  "JSS 1": "Junior Secondary School 1",
  "JSS 2": "Junior Secondary School 2",
  "JSS 3": "Junior Secondary School 3",
  "SS 1": "Senior Secondary School 1",
  "SS 2": "Senior Secondary School 2",
  "SS 3": "Senior Secondary School 3",
};

const emptySession: SessionForm = { name: "2026 / 2027", startsOn: "2026-09-01", endsOn: "2027-07-31", isCurrent: true };
const emptyTerm: TermForm = { sessionId: "", name: "First Term", termNumber: 1, startsOn: "2026-09-01", endsOn: "2026-12-18", isCurrent: true };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function subjectCode(name: string) {
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 6);
  return words[0].slice(0, 4);
}

export default function AcademicSetupV2({ initialData }: { initialData: AcademicDataV2 }) {
  const [data, setData] = useState(initialData);
  const [sessionForm, setSessionForm] = useState<SessionForm>(emptySession);
  const [termForm, setTermForm] = useState<TermForm>({ ...emptyTerm, sessionId: initialData.sessions[0]?.id ?? "" });
  const [activeLevel, setActiveLevel] = useState<LevelId | "">((initialData.school.capabilities?.[0] as LevelId) ?? "");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [classText, setClassText] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<string | undefined>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const capabilities = useMemo(
    () => (initialData.school.capabilities ?? []).filter((item): item is LevelId => SCHOOL_CAPABILITIES.some((capability) => capability.id === item)),
    [initialData.school.capabilities],
  );

  const currentSession = data.sessions.find((item) => item.is_current) ?? data.sessions[0];
  const currentTerms = useMemo(
    () => data.sessions.flatMap((session) => data.terms.filter((term) => term.academic_session_id === session.id).map((term) => ({ ...term, sessionName: session.name }))),
    [data.sessions, data.terms],
  );

  const levelOptions = useMemo(
    () => capabilities.flatMap((level) => CLASS_PRESETS[level].map((name) => ({ name, level }))),
    [capabilities],
  );

  function resetMessages() { setError(""); setNotice(""); }

  async function submit(action: string, body: Record<string, unknown>, success: string) {
    resetMessages();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, schoolId: data.school.id, ...body }),
      });
      const result = (await response.json()) as AcademicDataV2 & { error?: string };
      if (!response.ok) { setError(result.error ?? "Unable to save academic setup."); return false; }
      setData((current) => ({ ...current, ...(result.school ? { school: result.school } : {}), sessions: result.sessions, terms: result.terms, classes: result.classes, subjects: result.subjects }));
      setNotice(success);
      return true;
    } catch { setError("We couldn't reach the academic setup service. Try again."); return false; }
    finally { setSaving(false); }
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

  async function addSelectedClasses() {
    const selections = selectedClasses.length ? selectedClasses : (classText.trim() ? [classText.trim()] : []);
    if (!selections.length || !activeLevel) return;
    const result = await submit("create_classes", { classes: selections.map((name) => ({ name, level: activeLevel })) }, `${selections.length} class${selections.length === 1 ? "" : "es"} added.`);
    if (result) { setSelectedClasses([]); setClassText(""); }
  }

  async function saveSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = subjectName.trim();
    if (!name) return;
    const ok = await submit(editingSubjectId ? "update_subject" : "create_subject", { subjectId: editingSubjectId, name }, editingSubjectId ? "Subject updated." : "Subject added.");
    if (ok) { setSubjectName(""); setEditingSubjectId(undefined); }
  }

  function editSubject(item: { id: string; name: string }) { setEditingSubjectId(item.id); setSubjectName(item.name); }

  const availablePresetClasses = activeLevel ? CLASS_PRESETS[activeLevel] : [];
  const existingClassNames = new Set(data.classes.map((item) => item.name.toLowerCase()));
  const addablePresetClasses = availablePresetClasses.filter((name) => !existingClassNames.has(name.toLowerCase()));
  const previewCode = subjectCode(subjectName);

  return (
    <div className="academic-v2">
      <section className="page-heading">
        <div>
          <p className="eyebrow">ACADEMIC SETUP</p>
          <h1>Set up the school structure.</h1>
          <p className="muted">Academic sessions and terms define time. Capabilities, classes and subjects define the teaching structure.</p>
          <div className="context-strip"><span className="context-chip"><strong>{data.school.code}</strong> {data.school.name}</span><span className="context-chip">Current session <strong>{currentSession?.name ?? "Not configured"}</strong></span></div>
        </div>
      </section>

      {(error || notice) && <div className={error ? "form-alert form-alert-error" : "form-alert form-alert-success"} role={error ? "alert" : "status"}>{error || notice}</div>}

      <section className="academic-v2-grid">
        <section className="surface section-card">
          <div className="section-heading"><div><h2>Academic sessions</h2><p>Set the school year and choose the current session.</p></div><span className="count-badge">{data.sessions.length}</span></div>
          <div className="data-list">{data.sessions.map((session) => <article className="data-row" key={session.id}><div><strong>{session.name}</strong><p>{formatDate(session.starts_on)} – {formatDate(session.ends_on)}</p></div><div className="row-actions"><span className={session.is_current ? "status status-accepted" : "status status-provisioning"}>{session.is_current ? "Current" : "Inactive"}</span><button className="button-secondary" type="button" onClick={() => setSessionForm({ id: session.id, name: session.name, startsOn: session.starts_on, endsOn: session.ends_on, isCurrent: session.is_current })}>Edit</button></div></article>)}</div>
          <form className="inline-create" onSubmit={saveSession}><div className="section-subheading"><strong>{sessionForm.id ? "Edit session" : "Add session"}</strong><button className="text-button" type="button" onClick={() => setSessionForm({ ...emptySession })}>Reset</button></div><div className="form-grid"><label className="field">Session name<input value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} required /></label><label className="field">Starts<input type="date" value={sessionForm.startsOn} onChange={(e) => setSessionForm({ ...sessionForm, startsOn: e.target.value })} required /></label><label className="field">Ends<input type="date" value={sessionForm.endsOn} onChange={(e) => setSessionForm({ ...sessionForm, endsOn: e.target.value })} required /></label></div><label className="check-field"><input type="checkbox" checked={sessionForm.isCurrent} onChange={(e) => setSessionForm({ ...sessionForm, isCurrent: e.target.checked })} /> Make this the current session</label><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : sessionForm.id ? "Save session" : "Create session"}</button></form>
        </section>

        <section className="surface section-card">
          <div className="section-heading"><div><h2>Terms</h2><p>Set the teaching period and identify the current term.</p></div><span className="count-badge">{data.terms.length}</span></div>
          <div className="data-list">{currentTerms.map((term) => <article className="data-row" key={term.id}><div><strong>{term.name}</strong><p>{term.sessionName} · {formatDate(term.starts_on)} – {formatDate(term.ends_on)}</p></div><div className="row-actions"><span className={term.is_current ? "status status-accepted" : "status status-provisioning"}>{term.is_current ? "Current" : `Term ${term.term_number}`}</span><button className="button-secondary" type="button" onClick={() => setTermForm({ id: term.id, sessionId: term.academic_session_id, name: term.name, termNumber: term.term_number, startsOn: term.starts_on, endsOn: term.ends_on, isCurrent: term.is_current })}>Edit</button></div></article>)}</div>
          <form className="inline-create" onSubmit={saveTerm}><div className="section-subheading"><strong>{termForm.id ? "Edit term" : "Add term"}</strong><button className="text-button" type="button" onClick={() => setTermForm({ ...emptyTerm, sessionId: currentSession?.id ?? data.sessions[0]?.id ?? "" })}>Reset</button></div><div className="form-grid"><label className="field">Academic session<select value={termForm.sessionId} onChange={(e) => setTermForm({ ...termForm, sessionId: e.target.value })} required><option value="">Select session</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label><label className="field">Term<select value={termForm.termNumber} onChange={(e) => setTermForm({ ...termForm, termNumber: Number(e.target.value) })}><option value={1}>First Term</option><option value={2}>Second Term</option><option value={3}>Third Term</option></select></label><label className="field">Term name<input value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} required /></label><label className="field">Starts<input type="date" value={termForm.startsOn} onChange={(e) => setTermForm({ ...termForm, startsOn: e.target.value })} required /></label><label className="field">Ends<input type="date" value={termForm.endsOn} onChange={(e) => setTermForm({ ...termForm, endsOn: e.target.value })} required /></label></div><label className="check-field"><input type="checkbox" checked={termForm.isCurrent} onChange={(e) => setTermForm({ ...termForm, isCurrent: e.target.checked })} /> Make this the current term</label><button className="btn btn-primary" type="submit" disabled={saving || !termForm.sessionId}>{saving ? "Saving…" : termForm.id ? "Save term" : "Create term"}</button></form>
        </section>
      </section>

      <section className="surface section-card class-manager-card">
        <div className="section-heading"><div><h2>Classes</h2><p>Your school capabilities control which class levels are available here.</p></div><span className="count-badge">{data.classes.length}</span></div>
        <div className="class-builder-layout">
          <div className="class-builder-controls">
            <label className="field">Level / group<select value={activeLevel} onChange={(e) => { setActiveLevel(e.target.value as LevelId); setSelectedClasses([]); }}><option value="">Select a school capability</option>{capabilities.map((id) => <option key={id} value={id}>{SCHOOL_CAPABILITIES.find((item) => item.id === id)?.label}</option>)}</select></label>
            {activeLevel && <div className="preset-box"><div className="preset-head"><div><strong>Choose class levels</strong><span>Select all that apply, then add them together.</span></div><button type="button" className="text-button" onClick={() => setSelectedClasses(addablePresetClasses)}>Select all</button></div><div className="preset-grid">{addablePresetClasses.map((name) => <label className={`preset-option ${selectedClasses.includes(name) ? "is-selected" : ""}`} key={name}><input type="checkbox" checked={selectedClasses.includes(name)} onChange={() => setSelectedClasses((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])}/><span><strong>{name}</strong><small>{CLASS_DESCRIPTIONS[name] ?? name}</small></span></label>)}</div></div>}
            <div className="custom-class-box"><div><strong>Custom class</strong><span>Add a class name that is not in the preset list.</span></div><div className="custom-class-row"><input value={classText} onChange={(e) => setClassText(e.target.value)} placeholder="e.g. Reception"/><button type="button" className="btn btn-secondary" onClick={() => void addSelectedClasses()} disabled={saving || !activeLevel || !classText.trim()}>Add</button></div></div>
            <button type="button" className="btn btn-primary" onClick={() => void addSelectedClasses()} disabled={saving || !activeLevel || selectedClasses.length === 0}>Add selected classes{selectedClasses.length ? ` (${selectedClasses.length})` : ""}</button>
          </div>
          <div className="class-list-panel"><div className="section-subheading"><strong>Current classes</strong><span className="count-badge">{data.classes.length}</span></div><div className="data-list compact-list">{data.classes.length ? data.classes.map((item) => <article className="data-row" key={item.id}><div><strong>{item.name}</strong><p>{item.level || "Level not set"}</p></div><span className="status status-provisioning">Ready</span></article>) : <div className="empty-state"><strong>No classes yet.</strong><p>Pick a level and add multiple classes at once.</p></div>}</div></div>
        </div>
      </section>

      <section className="surface section-card">
        <div className="section-heading"><div><h2>Subjects</h2><p>Subject codes are generated automatically from the subject name.</p></div><span className="count-badge">{data.subjects.length}</span></div>
        <div className="subject-manager">
          <div className="data-list compact-list">{data.subjects.length ? data.subjects.map((item) => <article className="data-row" key={item.id}><div><strong>{item.name}</strong><p>Code · {item.code || subjectCode(item.name)}</p></div><button className="button-secondary" type="button" onClick={() => editSubject(item)}>Edit</button></article>) : <div className="empty-state"><strong>No subjects yet.</strong><p>Add the subjects this school teaches.</p></div>}</div>
          <form className="inline-create" onSubmit={saveSubject}><div className="section-subheading"><strong>{editingSubjectId ? "Edit subject" : "Add subject"}</strong><button className="text-button" type="button" onClick={() => { setSubjectName(""); setEditingSubjectId(undefined); }}>Reset</button></div><div className="form-grid"><label className="field">Subject name<input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Mathematics" required /></label><label className="field">Generated code<input value={previewCode} readOnly placeholder="Generated automatically" /></label></div><button className="btn btn-primary" type="submit" disabled={saving || !subjectName.trim()}>{saving ? "Saving…" : editingSubjectId ? "Save subject" : "Add subject"}</button></form>
        </div>
      </section>
    </div>
  );
}
