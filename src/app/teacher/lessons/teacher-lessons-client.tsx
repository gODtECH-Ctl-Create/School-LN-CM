"use client";

import { FormEvent, useMemo, useState } from "react";

export type LessonWorkspaceData = {
  school: { id: string; name: string; code: string };
  assignments: { class_id: string; subject_id: string; academic_session_id: string }[];
  classes: { id: string; name: string; level: string | null }[];
  subjects: { id: string; name: string; code: string | null }[];
  sessions: { id: string; name: string; is_current: boolean }[];
  terms: { id: string; academic_session_id: string; name: string; term_number: number; is_current: boolean }[];
  topics: { id: string; unit_id: string; title: string; week_number: number | null; lesson_count: number }[];
  notes: {
    id: string;
    curriculum_id: string | null;
    curriculum_unit_id: string | null;
    curriculum_topic_id: string | null;
    academic_session_id: string;
    term_id: string;
    class_id: string;
    subject_id: string;
    title: string;
    duration_minutes: number;
    learning_objectives: string | null;
    lesson_introduction: string | null;
    lesson_content: string | null;
    teacher_activities: string | null;
    learner_activities: string | null;
    assessment: string | null;
    homework: string | null;
    materials: string | null;
    status: "draft" | "published" | "archived";
    created_at: string;
    updated_at: string;
  }[];
};

type LessonForm = {
  id?: string;
  academicSessionId: string;
  termId: string;
  classId: string;
  subjectId: string;
  curriculumId: string;
  curriculumUnitId: string;
  curriculumTopicId: string;
  title: string;
  durationMinutes: number;
  learningObjectives: string;
  lessonIntroduction: string;
  lessonContent: string;
  teacherActivities: string;
  learnerActivities: string;
  assessment: string;
  homework: string;
  materials: string;
};

function emptyForm(data: LessonWorkspaceData): LessonForm {
  const session = data.sessions.find((item) => item.is_current) ?? data.sessions[0];
  const assignment = data.assignments[0];
  const term = data.terms.find((item) => item.academic_session_id === session?.id && item.is_current) ?? data.terms.find((item) => item.academic_session_id === session?.id);
  return {
    academicSessionId: assignment?.academic_session_id ?? session?.id ?? "",
    termId: term?.id ?? "",
    classId: assignment?.class_id ?? data.classes[0]?.id ?? "",
    subjectId: assignment?.subject_id ?? data.subjects[0]?.id ?? "",
    curriculumId: "",
    curriculumUnitId: "",
    curriculumTopicId: "",
    title: "",
    durationMinutes: 40,
    learningObjectives: "",
    lessonIntroduction: "",
    lessonContent: "",
    teacherActivities: "",
    learnerActivities: "",
    assessment: "",
    homework: "",
    materials: "",
  };
}

export default function TeacherLessonsClient({ initialData }: { initialData: LessonWorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState(initialData.notes[0]?.id ?? "");
  const [form, setForm] = useState<LessonForm>(() => {
    const initial = emptyForm(initialData);
    const first = initialData.notes[0];
    if (!first) return initial;
    return {
      ...initial,
      id: first.id,
      academicSessionId: first.academic_session_id,
      termId: first.term_id,
      classId: first.class_id,
      subjectId: first.subject_id,
      curriculumId: first.curriculum_id ?? "",
      curriculumUnitId: first.curriculum_unit_id ?? "",
      curriculumTopicId: first.curriculum_topic_id ?? "",
      title: first.title,
      durationMinutes: first.duration_minutes,
      learningObjectives: first.learning_objectives ?? "",
      lessonIntroduction: first.lesson_introduction ?? "",
      lessonContent: first.lesson_content ?? "",
      teacherActivities: first.teacher_activities ?? "",
      learnerActivities: first.learner_activities ?? "",
      assessment: first.assessment ?? "",
      homework: first.homework ?? "",
      materials: first.materials ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const availableTerms = useMemo(() => data.terms.filter((term) => term.academic_session_id === form.academicSessionId), [data.terms, form.academicSessionId]);
  const availableAssignments = useMemo(() => data.assignments.filter((item) => item.academic_session_id === form.academicSessionId), [data.assignments, form.academicSessionId]);
  const availableTopics = data.topics;
  const selectedNote = data.notes.find((note) => note.id === selectedId);

  function className(id: string) {
    return data.classes.find((item) => item.id === id)?.name ?? "Class";
  }
  function subjectName(id: string) {
    return data.subjects.find((item) => item.id === id)?.name ?? "Subject";
  }
  function sessionName(id: string) {
    return data.sessions.find((item) => item.id === id)?.name ?? "Session";
  }
  function termName(id: string) {
    return data.terms.find((item) => item.id === id)?.name ?? "Term";
  }

  function selectNote(id: string) {
    const note = data.notes.find((item) => item.id === id);
    if (!note) return;
    setSelectedId(id);
    setForm({
      id: note.id,
      academicSessionId: note.academic_session_id,
      termId: note.term_id,
      classId: note.class_id,
      subjectId: note.subject_id,
      curriculumId: note.curriculum_id ?? "",
      curriculumUnitId: note.curriculum_unit_id ?? "",
      curriculumTopicId: note.curriculum_topic_id ?? "",
      title: note.title,
      durationMinutes: note.duration_minutes,
      learningObjectives: note.learning_objectives ?? "",
      lessonIntroduction: note.lesson_introduction ?? "",
      lessonContent: note.lesson_content ?? "",
      teacherActivities: note.teacher_activities ?? "",
      learnerActivities: note.learner_activities ?? "",
      assessment: note.assessment ?? "",
      homework: note.homework ?? "",
      materials: note.materials ?? "",
    });
    setError("");
    setNotice("");
  }

  function newLesson() {
    const next = emptyForm(data);
    setSelectedId("");
    setForm(next);
    setError("");
    setNotice("");
  }

  function update(field: keyof LessonForm, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(action: "create" | "update" | "publish" | "archive") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lessonId: form.id,
          academicSessionId: form.academicSessionId,
          termId: form.termId,
          classId: form.classId,
          subjectId: form.subjectId,
          curriculumId: form.curriculumId || null,
          curriculumUnitId: form.curriculumUnitId || null,
          curriculumTopicId: form.curriculumTopicId || null,
          title: form.title,
          durationMinutes: form.durationMinutes,
          learningObjectives: form.learningObjectives,
          lessonIntroduction: form.lessonIntroduction,
          lessonContent: form.lessonContent,
          teacherActivities: form.teacherActivities,
          learnerActivities: form.learnerActivities,
          assessment: form.assessment,
          homework: form.homework,
          materials: form.materials,
        }),
      });
      const result = (await response.json()) as LessonWorkspaceData & { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save lesson note.");
        return;
      }
      setData((current) => ({ ...current, ...result }));
      setNotice(action === "publish" ? "Lesson note published." : action === "archive" ? "Lesson note archived." : action === "update" ? "Lesson note updated." : "Lesson note created.");

      const nextNote = action === "create"
        ? result.notes.find((item) => item.title === form.title && item.class_id === form.classId && item.subject_id === form.subjectId)
        : result.notes.find((item) => item.id === form.id);
      if (nextNote) {
        selectNote(nextNote.id);
      } else if (action === "archive") {
        setSelectedId("");
        setForm(emptyForm(result));
      }
    } catch {
      setError("We couldn't reach the lesson service. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(form.id ? "update" : "create");
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">MY LESSONS</p>
          <h1>Prepare tomorrow before it arrives.</h1>
          <p className="muted">Write lesson notes against the class, subject, term and curriculum context you actually teach.</p>
          <div className="context-strip">
            <span className="context-chip"><strong>{data.school.code}</strong> {data.school.name}</span>
            {form.academicSessionId && <span className="context-chip">Session <strong>{sessionName(form.academicSessionId)}</strong></span>}
            {form.termId && <span className="context-chip">Term <strong>{termName(form.termId)}</strong></span>}
          </div>
        </div>
        <button className="btn btn-primary" type="button" onClick={newLesson}>New lesson note <span aria-hidden="true">+</span></button>
      </section>

      {(error || notice) && <div className={error ? "form-alert form-alert-error" : "form-alert form-alert-success"} role={error ? "alert" : "status"}>{error || notice}</div>}

      <section className="teacher-lesson-workspace">
        <aside className="surface lesson-list-panel">
          <div className="section-heading"><div><h2>Lesson notes</h2><p>Your saved teaching work.</p></div><span className="count-badge">{data.notes.length}</span></div>
          <div className="lesson-filter-row">
            <span>{data.notes.length ? "Recent first" : "Ready for your first note"}</span>
            {selectedNote && <span className={`status status-${selectedNote.status === "published" ? "accepted" : selectedNote.status === "archived" ? "revoked" : "provisioning"}`}>{selectedNote.status}</span>}
          </div>
          <div className="saved-note-list">
            {data.notes.length ? data.notes.map((note) => <button type="button" className={`saved-note ${selectedId === note.id ? "is-selected" : ""}`} key={note.id} onClick={() => selectNote(note.id)}><span className="saved-note-title">{note.title}</span><span>{className(note.class_id)} · {subjectName(note.subject_id)}</span><small>{termName(note.term_id)} · {note.duration_minutes} min</small></button>) : <div className="empty-state"><strong>No lesson notes yet.</strong><p>Start with a note tied to one of your assigned classes and subjects.</p></div>}
          </div>
        </aside>

        <section className="surface lesson-editor-panel">
          <div className="lesson-editor-header"><div><p className="eyebrow">LESSON NOTE</p><h2>{form.id ? form.title || "Untitled lesson" : "New lesson note"}</h2><p className="muted">{form.classId ? className(form.classId) : "Choose a class"} · {form.subjectId ? subjectName(form.subjectId) : "Choose a subject"}</p></div>{form.id && selectedNote && <div className="row-actions">{selectedNote.status === "draft" && <button className="btn btn-primary" type="button" onClick={() => void submit("publish")} disabled={saving || !form.lessonContent.trim()}>Publish</button>}{selectedNote.status !== "archived" && <button className="button-danger" type="button" onClick={() => void submit("archive")} disabled={saving}>Archive</button>}</div>}</div>

          <form className="lesson-form" onSubmit={handleSubmit}>
            <section className="lesson-context-section"><div className="section-subheading"><div><strong>Teaching context</strong><span>These fields keep the note attached to the right school work.</span></div></div><div className="form-grid"><label className="field">Academic session<select value={form.academicSessionId} onChange={(event) => { const value = event.target.value; const term = data.terms.find((item) => item.academic_session_id === value && item.is_current) ?? data.terms.find((item) => item.academic_session_id === value); const assignment = data.assignments.find((item) => item.academic_session_id === value); setForm({ ...form, academicSessionId: value, termId: term?.id ?? "", classId: assignment?.class_id ?? form.classId, subjectId: assignment?.subject_id ?? form.subjectId }); }} required><option value="">Select session</option>{data.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_current ? " (Current)" : ""}</option>)}</select></label><label className="field">Term<select value={form.termId} onChange={(event) => update("termId", event.target.value)} required><option value="">Select term</option>{availableTerms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Class<select value={form.classId} onChange={(event) => update("classId", event.target.value)} required><option value="">Select assigned class</option>{data.classes.filter((item) => availableAssignments.some((assignment) => assignment.class_id === item.id && assignment.subject_id === form.subjectId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Subject<select value={form.subjectId} onChange={(event) => { const value = event.target.value; const assignment = availableAssignments.find((item) => item.subject_id === value); setForm({ ...form, subjectId: value, classId: assignment?.class_id ?? form.classId }); }} required><option value="">Select assigned subject</option>{data.subjects.filter((item) => availableAssignments.some((assignment) => assignment.subject_id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>)}</select></label></div>
              <div className="context-inline"><span>Class <strong>{form.classId ? className(form.classId) : "Not selected"}</strong></span><span>Subject <strong>{form.subjectId ? subjectName(form.subjectId) : "Not selected"}</strong></span><span>Session <strong>{form.academicSessionId ? sessionName(form.academicSessionId) : "Not selected"}</strong></span></div>
            </section>

            <section className="lesson-body-section"><div className="form-grid"><label className="field field-span-2">Lesson title<input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Place value and number sense" required /></label><label className="field">Duration (minutes)<input type="number" min={5} max={240} value={form.durationMinutes} onChange={(event) => update("durationMinutes", Number(event.target.value) || 40)} /></label><label className="field">Curriculum topic<select value={form.curriculumTopicId} onChange={(event) => update("curriculumTopicId", event.target.value)}><option value="">Not linked yet</option>{availableTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.week_number ? `Week ${topic.week_number} · ` : ""}{topic.title}</option>)}</select></label></div>
              <label className="field">Learning objectives<textarea rows={3} value={form.learningObjectives} onChange={(event) => update("learningObjectives", event.target.value)} placeholder="What should learners understand or be able to do by the end of the lesson?" /></label>
              <div className="lesson-two-column"><label className="field"><span>Introduction</span><textarea rows={5} value={form.lessonIntroduction} onChange={(event) => update("lessonIntroduction", event.target.value)} placeholder="Starter, prior knowledge and lesson hook." /></label><label className="field"><span>Materials</span><textarea rows={5} value={form.materials} onChange={(event) => update("materials", event.target.value)} placeholder="Books, board work, manipulatives, slides or other resources." /></label></div>
              <label className="field"><span>Lesson content</span><textarea className="lesson-main-textarea" rows={12} value={form.lessonContent} onChange={(event) => update("lessonContent", event.target.value)} placeholder="Write the teaching sequence here. This is the main working area and will later support curriculum-aware generation and revision." /></label>
              <div className="lesson-two-column"><label className="field"><span>Teacher activities</span><textarea rows={6} value={form.teacherActivities} onChange={(event) => update("teacherActivities", event.target.value)} placeholder="Explain, model, question, demonstrate…" /></label><label className="field"><span>Learner activities</span><textarea rows={6} value={form.learnerActivities} onChange={(event) => update("learnerActivities", event.target.value)} placeholder="Discuss, practise, solve, present…" /></label></div>
              <div className="lesson-two-column"><label className="field"><span>Assessment</span><textarea rows={5} value={form.assessment} onChange={(event) => update("assessment", event.target.value)} placeholder="Checks for understanding and evidence of learning." /></label><label className="field"><span>Homework</span><textarea rows={5} value={form.homework} onChange={(event) => update("homework", event.target.value)} placeholder="Optional follow-up work." /></label></div>
            </section>

            <div className="lesson-form-footer"><p>Save as a draft while you work. Publishing makes the note ready for your teaching workflow.</p><button className="btn btn-primary" type="submit" disabled={saving || !form.academicSessionId || !form.termId || !form.classId || !form.subjectId}>{saving ? "Saving…" : form.id ? "Save changes" : "Create lesson note"}</button></div>
          </form>
        </section>
      </section>
    </>
  );
}
