"use client";

import { FormEvent, useMemo, useState } from "react";

export type CurriculumData = {
  schools: { id: string; name: string; code: string }[];
  school: { id: string; name: string; code: string };
  sessions: { id: string; name: string; starts_on: string; ends_on: string; is_current: boolean }[];
  terms: { id: string; academic_session_id: string; name: string; term_number: number; starts_on: string; ends_on: string; is_current: boolean }[];
  classes: { id: string; name: string; level: string | null }[];
  subjects: { id: string; name: string; code: string | null }[];
  curricula: { id: string; academic_session_id: string; term_id: string; class_id: string; subject_id: string; title: string; description: string | null; status: "draft" | "published" | "archived"; created_by: string | null; published_at: string | null; created_at: string; updated_at: string }[];
  units: { id: string; curriculum_id: string; unit_number: number; title: string; summary: string | null; sort_order: number; created_at: string; updated_at: string }[];
  topics: { id: string; unit_id: string; title: string; summary: string | null; week_number: number | null; lesson_count: number; sort_order: number; created_at: string; updated_at: string }[];
};

type CurriculumForm = { id?: string; sessionId: string; termId: string; classId: string; subjectId: string; title: string; description: string };
type UnitForm = { id?: string; unitNumber: number; title: string; summary: string };
type TopicForm = { id?: string; title: string; summary: string; weekNumber: string; lessonCount: number };

type ApiResult = CurriculumData & { error?: string };

export default function CurriculumClient({ initialData }: { initialData: CurriculumData }) {
  const [data, setData] = useState(initialData);
  const defaultSession = initialData.sessions.find((item) => item.is_current) ?? initialData.sessions[0];
  const defaultTerm = initialData.terms.find((item) => item.academic_session_id === defaultSession?.id && item.is_current) ?? initialData.terms.find((item) => item.academic_session_id === defaultSession?.id);
  const [form, setForm] = useState<CurriculumForm>({
    sessionId: defaultSession?.id ?? "",
    termId: defaultTerm?.id ?? "",
    classId: initialData.classes[0]?.id ?? "",
    subjectId: initialData.subjects[0]?.id ?? "",
    title: "",
    description: "",
  });
  const [selectedId, setSelectedId] = useState(initialData.curricula[0]?.id ?? "");
  const [unitForm, setUnitForm] = useState<UnitForm>({ unitNumber: 1, title: "", summary: "" });
  const [topicForm, setTopicForm] = useState<TopicForm>({ title: "", summary: "", weekNumber: "", lessonCount: 1 });
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const availableTerms = useMemo(() => data.terms.filter((term) => term.academic_session_id === form.sessionId), [data.terms, form.sessionId]);
  const selected = data.curricula.find((item) => item.id === selectedId);
  const selectedUnits = data.units.filter((unit) => unit.curriculum_id === selectedId).sort((a, b) => a.sort_order - b.sort_order);

  function relatedName(kind: "session" | "term" | "class" | "subject", id: string) {
    const source = kind === "session" ? data.sessions : kind === "term" ? data.terms : kind === "class" ? data.classes : data.subjects;
    return source.find((item) => item.id === id)?.name ?? "Not set";
  }

  function setSelectedCurriculum(id: string) {
    const item = data.curricula.find((value) => value.id === id);
    if (!item) return;
    setSelectedId(id);
    setForm({ id: item.id, sessionId: item.academic_session_id, termId: item.term_id, classId: item.class_id, subjectId: item.subject_id, title: item.title, description: item.description ?? "" });
    setSelectedUnitId("");
    setTopicForm({ title: "", summary: "", weekNumber: "", lessonCount: 1 });
    setUnitForm({ unitNumber: data.units.filter((unit) => unit.curriculum_id === id).length + 1, title: "", summary: "" });
  }

  async function submit(action: string, body: Record<string, unknown>, success: string) {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/curriculum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, schoolId: data.school.id, ...body }) });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) {
        setError(result.error ?? "Unable to update curriculum.");
        return null;
      }
      setData((current) => ({ ...current, sessions: result.sessions, terms: result.terms, classes: result.classes, subjects: result.subjects, curricula: result.curricula, units: result.units, topics: result.topics }));
      setNotice(success);
      return result;
    } catch {
      setError("We couldn't reach the curriculum service. Try again.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveCurriculum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentId = form.id;
    const result = await submit(currentId ? "update_curriculum" : "create_curriculum", { curriculumId: currentId, sessionId: form.sessionId, termId: form.termId, classId: form.classId, subjectId: form.subjectId, title: form.title, description: form.description }, currentId ? "Curriculum updated." : "Curriculum created as a draft.");
    if (!result) return;
    const next = currentId ?? result.curricula.find((item) => item.title === form.title && item.class_id === form.classId && item.subject_id === form.subjectId)?.id;
    if (next) {
      const item = result.curricula.find((value) => value.id === next);
      setSelectedId(next);
      if (item) setForm({ id: item.id, sessionId: item.academic_session_id, termId: item.term_id, classId: item.class_id, subjectId: item.subject_id, title: item.title, description: item.description ?? "" });
      setUnitForm({ unitNumber: result.units.filter((unit) => unit.curriculum_id === next).length + 1, title: "", summary: "" });
    }
  }

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const result = await submit(unitForm.id ? "update_unit" : "create_unit", { curriculumId: selectedId, unitId: unitForm.id, unitNumber: unitForm.unitNumber, unitTitle: unitForm.title, unitSummary: unitForm.summary, sortOrder: unitForm.unitNumber }, unitForm.id ? "Unit updated." : "Unit added.");
    if (result) {
      setUnitForm({ unitNumber: result.units.filter((unit) => unit.curriculum_id === selectedId).length + 1, title: "", summary: "" });
      setSelectedUnitId("");
    }
  }

  async function saveTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUnitId) return;
    const result = await submit(topicForm.id ? "update_topic" : "create_topic", { unitId: selectedUnitId, topicId: topicForm.id, topicTitle: topicForm.title, topicSummary: topicForm.summary, weekNumber: topicForm.weekNumber ? Number(topicForm.weekNumber) : null, lessonCount: topicForm.lessonCount, sortOrder: data.topics.filter((topic) => topic.unit_id === selectedUnitId).length + 1 }, topicForm.id ? "Topic updated." : "Topic added.");
    if (result) setTopicForm({ title: "", summary: "", weekNumber: "", lessonCount: 1 });
  }

  async function changeStatus(action: "publish_curriculum" | "archive_curriculum") {
    if (!selectedId) return;
    const result = await submit(action, { curriculumId: selectedId }, action === "publish_curriculum" ? "Curriculum published." : "Curriculum archived.");
    if (result && action === "archive_curriculum") setSelectedId("");
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">CURRICULUM</p>
          <h1>Build teaching, not just tables.</h1>
          <p className="muted">Create a curriculum for one class and subject, then break it into units and topics that teachers can carry into lesson preparation.</p>
          <div className="context-strip"><span className="context-chip"><strong>{data.school.code}</strong> {data.school.name}</span><span className="context-chip">Session <strong>{relatedName("session", form.sessionId)}</strong></span></div>
        </div>
        <span className="live-indicator"><span aria-hidden="true" /> Curriculum workspace</span>
      </section>

      {(error || notice) && <div className={error ? "form-alert form-alert-error" : "form-alert form-alert-success"} role={error ? "alert" : "status"}>{error || notice}</div>}

      <section className="surface curriculum-context-card">
        <div className="section-heading"><div><h2>Curriculum context</h2><p>A curriculum belongs to one session, term, class and subject.</p></div><span className="status status-provisioning">Draft-first</span></div>
        <form className="curriculum-form" onSubmit={saveCurriculum}>
          <div className="form-grid">
            <label className="field">Academic session<select value={form.sessionId} onChange={(event) => { const sessionId = event.target.value; const term = data.terms.find((item) => item.academic_session_id === sessionId && item.is_current) ?? data.terms.find((item) => item.academic_session_id === sessionId); setForm({ ...form, sessionId, termId: term?.id ?? "" }); }} required><option value="">Select session</option>{data.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_current ? " (Current)" : ""}</option>)}</select></label>
            <label className="field">Term<select value={form.termId} onChange={(event) => setForm({ ...form, termId: event.target.value })} required><option value="">Select term</option>{availableTerms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field">Class<select value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} required><option value="">Select class</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field">Subject<select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} required><option value="">Select subject</option>{data.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>)}</select></label>
          </div>
          <label className="field">Curriculum title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Primary 5 Mathematics · First Term" required /></label>
          <label className="field">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What this curriculum covers and how teachers should use it." rows={3} /></label>
          <div className="form-footer"><p>The title becomes the teaching plan name teachers see later.</p><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : form.id ? "Save curriculum" : "Create curriculum"}</button></div>
        </form>
      </section>

      <section className="curriculum-workbench">
        <aside className="surface curriculum-list-card">
          <div className="section-heading"><div><h2>Your curricula</h2><p>{data.curricula.length} plan{data.curricula.length === 1 ? "" : "s"}</p></div><span className="count-badge">{data.curricula.length}</span></div>
          <div className="curriculum-list">{data.curricula.length ? data.curricula.map((item) => <button key={item.id} type="button" className={`curriculum-item ${selectedId === item.id ? "is-selected" : ""}`} onClick={() => setSelectedCurriculum(item.id)}><span className="curriculum-item-title">{item.title}</span><span>{relatedName("class", item.class_id)} · {relatedName("subject", item.subject_id)}</span><small>{relatedName("term", item.term_id)} · <strong>{item.status}</strong></small></button>) : <div className="empty-state"><strong>No curriculum plans yet.</strong><p>Create the first plan above.</p></div>}</div>
        </aside>

        <section className="surface curriculum-editor">
          {!selected ? <div className="editor-empty"><div className="editor-mark">C</div><p className="eyebrow">CURRICULUM EDITOR</p><h2>Select a curriculum to build its sequence.</h2><p className="muted">Units and topics become the structure teachers use when preparing lessons. Keep work in draft until the sequence is ready.</p></div> : <>
            <div className="editor-header"><div><p className="eyebrow">{selected.status.toUpperCase()}</p><h2>{selected.title}</h2><p className="muted">{relatedName("class", selected.class_id)} · {relatedName("subject", selected.subject_id)} · {relatedName("term", selected.term_id)}</p></div><div className="row-actions"><span className={`status status-${selected.status === "published" ? "accepted" : selected.status === "archived" ? "revoked" : "provisioning"}`}>{selected.status}</span>{selected.status === "draft" && <button className="btn btn-primary" type="button" onClick={() => void changeStatus("publish_curriculum")} disabled={saving}>Publish</button>}{selected.status !== "archived" && <button className="button-danger" type="button" onClick={() => void changeStatus("archive_curriculum")} disabled={saving}>Archive</button>}</div></div>

            <div className="unit-list">{selectedUnits.length ? selectedUnits.map((unit) => {
              const topics = data.topics.filter((topic) => topic.unit_id === unit.id).sort((a, b) => a.sort_order - b.sort_order);
              const active = selectedUnitId === unit.id;
              return <article className={`unit-card ${active ? "is-active" : ""}`} key={unit.id}><button type="button" className="unit-header" onClick={() => { setSelectedUnitId(active ? "" : unit.id); setTopicForm({ title: "", summary: "", weekNumber: "", lessonCount: 1 }); }}><span className="unit-number">{unit.unit_number}</span><span><strong>{unit.title}</strong><small>{unit.summary || "No unit summary yet."}</small></span><span className="unit-count">{topics.length} topic{topics.length === 1 ? "" : "s"}</span></button>{active && <div className="topic-area"><div className="topic-list">{topics.length ? topics.map((topic) => <div className="topic-row" key={topic.id}><span className="topic-week">{topic.week_number ? `W${topic.week_number}` : "--"}</span><div><strong>{topic.title}</strong><p>{topic.summary || "No topic summary yet."}</p></div><span className="topic-lessons">{topic.lesson_count} lesson{topic.lesson_count === 1 ? "" : "s"}</span><button className="button-secondary" type="button" onClick={() => setTopicForm({ id: topic.id, title: topic.title, summary: topic.summary ?? "", weekNumber: topic.week_number ? String(topic.week_number) : "", lessonCount: topic.lesson_count })}>Edit</button></div>) : <div className="empty-state"><strong>No topics in this unit.</strong><p>Add the first teaching topic below.</p></div>}</div><form className="topic-form" onSubmit={saveTopic}><div className="section-subheading"><strong>{topicForm.id ? "Edit topic" : "Add topic"}</strong><button className="text-button" type="button" onClick={() => setTopicForm({ title: "", summary: "", weekNumber: "", lessonCount: 1 })}>Reset</button></div><div className="form-grid"><label className="field">Topic title<input value={topicForm.title} onChange={(event) => setTopicForm({ ...topicForm, title: event.target.value })} placeholder="Place value and number sense" required /></label><label className="field">Week<input type="number" min={1} max={52} value={topicForm.weekNumber} onChange={(event) => setTopicForm({ ...topicForm, weekNumber: event.target.value })} placeholder="1" /></label><label className="field">Lessons<input type="number" min={1} max={30} value={topicForm.lessonCount} onChange={(event) => setTopicForm({ ...topicForm, lessonCount: Math.max(1, Number(event.target.value) || 1) })} /></label></div><label className="field">Topic summary<textarea rows={2} value={topicForm.summary} onChange={(event) => setTopicForm({ ...topicForm, summary: event.target.value })} placeholder="What students should work through in this topic." /></label><button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? "Saving…" : topicForm.id ? "Save topic" : "Add topic"}</button></form></div>}</article>;
            }) : <div className="empty-state"><strong>No units yet.</strong><p>Start the sequence with Unit 1, then add its topics and teaching weeks.</p></div>}</div>

            {selected.status !== "archived" && <form className="unit-create" onSubmit={saveUnit}><div className="section-subheading"><div><strong>{unitForm.id ? "Edit unit" : "Add a unit"}</strong><span>Add the next chunk of teaching content.</span></div><button className="text-button" type="button" onClick={() => setUnitForm({ unitNumber: selectedUnits.length + 1, title: "", summary: "" })}>Reset</button></div><div className="form-grid"><label className="field">Unit number<input type="number" min={1} value={unitForm.unitNumber} onChange={(event) => setUnitForm({ ...unitForm, unitNumber: Math.max(1, Number(event.target.value) || 1) })} required /></label><label className="field">Unit title<input value={unitForm.title} onChange={(event) => setUnitForm({ ...unitForm, title: event.target.value })} placeholder="Whole numbers" required /></label></div><label className="field">Unit summary<textarea rows={2} value={unitForm.summary} onChange={(event) => setUnitForm({ ...unitForm, summary: event.target.value })} placeholder="A concise description of the unit." /></label><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : unitForm.id ? "Save unit" : "Add unit"}</button></form>}
          </>}
        </section>
      </section>

      <p className="curriculum-footnote"><strong>Next:</strong> published curriculum topics will feed the teacher lesson workspace and the curriculum-aware lesson-note builder.</p>

      <style jsx global>{`
        .curriculum-context-card { padding: 22px; margin-bottom: 16px; }
        .curriculum-form { display: grid; gap: 16px; }
        .curriculum-form textarea, .field textarea { width: 100%; resize: vertical; min-height: 44px; border: 1px solid var(--line-strong); border-radius: 11px; padding: 10px 12px; outline: none; background: #fff; color: var(--ink); }
        .curriculum-form textarea:focus, .field textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(49,87,213,.10); }
        .curriculum-workbench { display: grid; grid-template-columns: 320px minmax(0,1fr); gap: 16px; }
        .curriculum-list-card { padding: 18px; align-self: start; }
        .curriculum-list { display: grid; gap: 8px; }
        .curriculum-item { width: 100%; display: grid; gap: 5px; text-align: left; padding: 13px; border: 1px solid var(--line); border-radius: 13px; background: #fff; color: var(--ink-soft); cursor: pointer; }
        .curriculum-item:hover { border-color: #b8c4e8; background: var(--surface-soft); }
        .curriculum-item.is-selected { border-color: #b8c4e8; box-shadow: 0 0 0 3px rgba(49,87,213,.08); background: var(--primary-soft); }
        .curriculum-item-title { color: var(--ink); font-size: 12px; font-weight: 850; line-height: 1.4; }
        .curriculum-item span:not(.curriculum-item-title), .curriculum-item small { color: var(--muted); font-size: 10px; line-height: 1.4; }
        .curriculum-item small strong { text-transform: capitalize; color: var(--ink-soft); }
        .curriculum-editor { min-width: 0; padding: 22px; }
        .editor-empty { min-height: 430px; display: grid; align-content: center; justify-items: start; max-width: 520px; padding: 26px 10px; }
        .editor-empty h2 { max-width: 540px; margin: 0 0 8px; font-size: 25px; letter-spacing: -.035em; }
        .editor-mark { width: 48px; height: 48px; display: grid; place-items: center; margin-bottom: 20px; border-radius: 15px; background: var(--ink); color: #fff; font-weight: 900; }
        .editor-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid var(--line); }
        .editor-header h2 { margin: 0; font-size: 22px; letter-spacing: -.03em; }
        .editor-header .muted { margin: 6px 0 0; font-size: 11px; }
        .unit-list { display: grid; gap: 10px; }
        .unit-card { border: 1px solid var(--line); border-radius: 14px; background: #fff; overflow: hidden; }
        .unit-card.is-active { border-color: #bdc8ea; }
        .unit-header { width: 100%; display: grid; grid-template-columns: 34px minmax(0,1fr) auto; gap: 12px; align-items: center; text-align: left; border: 0; background: transparent; padding: 13px; color: var(--ink); cursor: pointer; }
        .unit-number { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px; background: var(--primary-soft); color: var(--primary-dark); font-size: 11px; font-weight: 900; }
        .unit-header strong { display: block; font-size: 12px; }
        .unit-header small { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; line-height: 1.4; }
        .unit-count { color: var(--muted); font-size: 10px; font-weight: 750; }
        .topic-area { padding: 0 13px 14px; }
        .topic-list { display: grid; gap: 7px; }
        .topic-row { display: grid; grid-template-columns: 40px minmax(0,1fr) auto auto; gap: 9px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); }
        .topic-week { width: 36px; height: 28px; display: grid; place-items: center; border-radius: 8px; background: #fff; border: 1px solid var(--line); color: var(--muted); font-size: 9px; font-weight: 850; }
        .topic-row strong { font-size: 11px; }
        .topic-row p { margin: 3px 0 0; color: var(--muted); font-size: 9px; line-height: 1.4; }
        .topic-lessons { color: var(--muted); font-size: 9px; white-space: nowrap; }
        .topic-form { display: grid; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
        .topic-form .form-grid { grid-template-columns: minmax(0,1fr) 100px 120px; }
        .unit-create { display: grid; gap: 13px; margin-top: 15px; padding: 16px; border: 1px dashed var(--line-strong); border-radius: 14px; background: #fcfcfd; }
        .unit-create .section-subheading span { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; }
        .curriculum-footnote { margin: 16px 2px 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
        .curriculum-footnote strong { color: var(--ink-soft); }
        @media (max-width: 1080px) { .curriculum-workbench { grid-template-columns: 1fr; } .curriculum-list { grid-template-columns: repeat(2,minmax(0,1fr)); } }
        @media (max-width: 680px) { .curriculum-list { grid-template-columns: 1fr; } .editor-header { flex-direction: column; } .topic-row { grid-template-columns: 36px minmax(0,1fr); } .topic-lessons { grid-column: 2; } .topic-row button { grid-column: 2; justify-self: start; } .topic-form .form-grid, .unit-create .form-grid { grid-template-columns: 1fr; } .curriculum-context-card, .curriculum-editor, .curriculum-list-card { padding: 16px; } }
      `}</style>
    </>
  );
}
