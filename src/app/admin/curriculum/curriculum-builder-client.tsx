"use client";

import { useMemo, useState } from "react";
import { normalizeSection, SUBJECT_CATALOG } from "@/src/lib/subject-catalog";
import styles from "./curriculum-builder.module.css";

type Subject = { id: string; name: string; code: string | null; is_custom?: boolean };
type Curriculum = {
  id: string;
  academic_session_id: string;
  term_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  week_count: number;
};
type Topic = { id: string; unit_id: string; title: string; summary: string | null; week_number: number | null };
type Unit = { id: string; curriculum_id: string; title: string; unit_number: number };
export type CurriculumBuilderData = {
  school: { id: string; name: string; code: string };
  sessions: { id: string; name: string; is_current: boolean }[];
  terms: { id: string; academic_session_id: string; name: string; term_number: number; is_current: boolean }[];
  classes: { id: string; name: string; level: string | null }[];
  subjects: Subject[];
  curricula: Curriculum[];
  units: Unit[];
  topics: Topic[];
};

type ApiResult = CurriculumBuilderData & { error?: string; subject?: Subject };
type WeekDraft = { id?: string; weekNumber: number; title: string; summary: string };

function getSection(level: string | null) {
  return normalizeSection(level);
}

function buildWeekDrafts(plan: Curriculum | undefined, source: CurriculumBuilderData): WeekDraft[] {
  if (!plan) return [];
  const unitIds = new Set(source.units.filter((unit) => unit.curriculum_id === plan.id).map((unit) => unit.id));
  const planTopics = source.topics
    .filter((topic) => unitIds.has(topic.unit_id) && topic.week_number !== null)
    .sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0));
  const count = plan.week_count || 10;
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const topic = planTopics.find((item) => item.week_number === number);
    return {
      id: topic?.id,
      weekNumber: number,
      title: topic?.title === `Week ${number}` ? "" : topic?.title ?? "",
      summary: topic?.summary ?? "",
    };
  });
}

export default function CurriculumBuilderClient({ initialData }: { initialData: CurriculumBuilderData }) {
  const [data, setData] = useState(initialData);
  const currentSession = data.sessions.find((item) => item.is_current) ?? data.sessions[0];
  const currentTerm = data.terms.find((item) => item.academic_session_id === currentSession?.id && item.is_current) ?? data.terms.find((item) => item.academic_session_id === currentSession?.id);
  const [sessionId] = useState(currentSession?.id ?? "");
  const [termId, setTermId] = useState(currentTerm?.id ?? "");
  const sections = useMemo(() => [...new Set(data.classes.map((item) => getSection(item.level)))].sort(), [data.classes]);
  const [section, setSection] = useState(sections[0] ?? "");
  const sectionClasses = useMemo(() => data.classes.filter((item) => getSection(item.level) === section), [data.classes, section]);
  const [classId, setClassId] = useState(sectionClasses[0]?.id ?? "");
  const existingPlans = useMemo(
    () => data.curricula.filter((item) => item.academic_session_id === sessionId && item.term_id === termId && item.class_id === classId),
    [data.curricula, sessionId, termId, classId],
  );
  const existingSubjectIds = useMemo(() => new Set(existingPlans.map((item) => item.subject_id)), [existingPlans]);
  const recommendedSubjects = useMemo(() => {
    const recommendedNames = new Set(SUBJECT_CATALOG.filter((item) => item.sections.includes(section) || section === "Other").map((item) => item.name.toLowerCase()));
    return [...data.subjects].sort((a, b) => {
      const ar = recommendedNames.has(a.name.toLowerCase()) ? 0 : 1;
      const br = recommendedNames.has(b.name.toLowerCase()) ? 0 : 1;
      return ar - br || a.name.localeCompare(b.name);
    });
  }, [data.subjects, section]);
  const firstPlan = existingPlans[0];
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [weekCount, setWeekCount] = useState(firstPlan?.week_count ?? 10);
  const [activeSubjectId, setActiveSubjectId] = useState(firstPlan?.subject_id ?? "");
  const [weeks, setWeeks] = useState<WeekDraft[]>(() => buildWeekDrafts(firstPlan, initialData));
  const [newCustomSubject, setNewCustomSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activePlan = existingPlans.find((item) => item.subject_id === activeSubjectId) ?? existingPlans[0];

  function selectPlan(plan: Curriculum | undefined, source = data) {
    setActiveSubjectId(plan?.subject_id ?? "");
    setWeeks(buildWeekDrafts(plan, source));
    setWeekCount(plan?.week_count ?? 10);
  }

  function changeSection(nextSection: string) {
    setSection(nextSection);
    const nextClass = data.classes.find((item) => getSection(item.level) === nextSection);
    setClassId(nextClass?.id ?? "");
    setSelectedSubjectIds([]);
    setWeeks([]);
    setActiveSubjectId("");
  }

  function changeClass(nextClassId: string) {
    setClassId(nextClassId);
    const nextPlan = data.curricula.find((item) => item.academic_session_id === sessionId && item.term_id === termId && item.class_id === nextClassId);
    setSelectedSubjectIds([]);
    selectPlan(nextPlan);
  }

  function changeTerm(nextTermId: string) {
    setTermId(nextTermId);
    const nextPlan = data.curricula.find((item) => item.academic_session_id === sessionId && item.term_id === nextTermId && item.class_id === classId);
    setSelectedSubjectIds([]);
    selectPlan(nextPlan);
  }

  function toggleSubject(id: string) {
    setSelectedSubjectIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function post(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, schoolId: data.school.id, ...payload }),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) {
        setError(result.error ?? "Unable to update curriculum.");
        return null;
      }
      setData(result);
      return result;
    } catch {
      setError("We couldn't reach the curriculum service. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createSelectedCurricula() {
    const count = selectedSubjectIds.length;
    const result = await post("create_curricula", { sessionId, termId, classId, subjectIds: selectedSubjectIds, weekCount });
    if (!result) return;
    setSelectedSubjectIds([]);
    const nextPlans = result.curricula.filter((item) => item.academic_session_id === sessionId && item.term_id === termId && item.class_id === classId);
    const nextPlan = nextPlans.find((item) => selectedSubjectIds.includes(item.subject_id)) ?? nextPlans[0];
    selectPlan(nextPlan, result);
    setMessage(`${count} subject plan${count === 1 ? "" : "s"} ready.`);
  }

  async function addCustomSubject() {
    const name = newCustomSubject.trim();
    if (!name) return;
    const result = await post("create_subject", { subjectName: name });
    if (!result?.subject) return;
    setNewCustomSubject("");
    setSelectedSubjectIds((current) => [...current, result.subject!.id]);
    setMessage(`${result.subject.name} added to your school subjects.`);
  }

  async function saveWeeks() {
    if (!activePlan) return;
    const result = await post("save_weeks", { curriculumId: activePlan.id, weeks });
    if (!result) return;
    const updatedPlan = result.curricula.find((item) => item.id === activePlan.id);
    selectPlan(updatedPlan, result);
    setMessage("Weekly curriculum saved.");
  }

  const selectedCount = selectedSubjectIds.length;
  const subjectName = (id: string) => data.subjects.find((subject) => subject.id === id)?.name ?? "Subject";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className="eyebrow">CURRICULUM</p><h1>Build the term once.</h1><p className="muted">Choose the class context, tick the subjects, choose the number of weeks, then complete each subject week by week.</p></div>
        <div className={styles.context}><span>{data.school.code}</span><strong>{currentSession?.name ?? "No session"}</strong><span>{data.terms.find((term) => term.id === termId)?.name ?? "No term"}</span></div>
      </header>

      {error && <div className={styles.alertError} role="alert">{error}</div>}
      {message && <div className={styles.alertSuccess} role="status">{message}</div>}

      <section className={styles.contextCard}>
        <div className={styles.sectionTop}><div><strong>1. Curriculum context</strong><span>Session follows the current school session automatically.</span></div><span className={styles.currentBadge}>{currentSession?.name ?? "Not set"}</span></div>
        <div className={styles.controls}>
          <label>Term<select value={termId} onChange={(event) => changeTerm(event.target.value)}>{data.terms.filter((term) => term.academic_session_id === sessionId).map((term) => <option key={term.id} value={term.id}>{term.name}{term.is_current ? " · Current" : ""}</option>)}</select></label>
          <label>Section<select value={section} onChange={(event) => changeSection(event.target.value)}>{sections.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Class<select value={classId} onChange={(event) => changeClass(event.target.value)}>{sectionClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>
      </section>

      <section className={styles.subjectCard}>
        <div className={styles.sectionTop}><div><strong>2. Subjects</strong><span>Existing curriculum appears automatically. Pick only subjects that are still missing.</span></div><span className={styles.count}>{existingPlans.length} existing</span></div>
        {existingPlans.length ? <div className={styles.existingList}>{existingPlans.map((plan) => <button type="button" key={plan.id} className={`${styles.subjectTab} ${activePlan?.id === plan.id ? styles.active : ""}`} onClick={() => selectPlan(plan)}><span>{subjectName(plan.subject_id)}</span><small>{plan.week_count} weeks · {plan.status}</small></button>)}</div> : <div className={styles.empty}>No curriculum exists for this class yet.</div>}

        <div className={styles.subjectPicker}>
          <div className={styles.pickerHead}><strong>{existingPlans.length ? "Add another subject" : "Choose subjects"}</strong><span>{selectedCount} selected</span></div>
          <div className={styles.subjectGrid}>{recommendedSubjects.filter((subject) => !existingSubjectIds.has(subject.id)).map((subject) => <label key={subject.id} className={styles.subjectOption}><input type="checkbox" checked={selectedSubjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} /><span><strong>{subject.name}</strong><small>{subject.is_custom ? "Custom" : subject.code ?? "System"}</small></span></label>)}</div>
          <div className={styles.customRow}><div><strong>Custom subject</strong><span>Add a school-specific subject when it is not on the system list.</span></div><div className={styles.addSubject}><input value={newCustomSubject} onChange={(event) => setNewCustomSubject(event.target.value)} placeholder="e.g. French" /><button type="button" className="btn btn-secondary" onClick={() => void addCustomSubject()} disabled={busy || !newCustomSubject.trim()}>Add</button></div></div>
        </div>
      </section>

      <section className={styles.weekSetup}>
        <div className={styles.sectionTop}><div><strong>3. Weekly template</strong><span>Choose once for the selected subject plans.</span></div><span className={styles.count}>{weekCount} weeks</span></div>
        <div className={styles.weekChoices}>{[8, 9, 10, 11, 12, 13].map((number) => <button type="button" className={weekCount === number ? styles.weekChoiceActive : styles.weekChoice} key={number} onClick={() => setWeekCount(number)}>{number}<small>weeks</small></button>)}</div>
        <button className="btn btn-primary" type="button" onClick={() => void createSelectedCurricula()} disabled={busy || !classId || !termId || selectedCount === 0}>Create selected subject{selectedCount === 1 ? "" : "s"} <span aria-hidden="true">→</span></button>
      </section>

      {activePlan && <section className={styles.editorCard}>
        <div className={styles.editorHeader}><div><p className="eyebrow">4. {subjectName(activePlan.subject_id).toUpperCase()}</p><h2>{subjectName(activePlan.subject_id)}</h2><p className="muted">{data.classes.find((item) => item.id === classId)?.name} · {data.terms.find((item) => item.id === termId)?.name}</p></div><span className={styles.currentBadge}>{activePlan.week_count} weeks</span></div>
        <div className={styles.subjectSwitcher}>{existingPlans.map((plan) => <button type="button" key={plan.id} className={activePlan.id === plan.id ? styles.switchActive : styles.switch} onClick={() => selectPlan(plan)}>{subjectName(plan.subject_id)}</button>)}</div>
        <div className={styles.weeks}>{weeks.map((week) => <article className={styles.weekRow} key={week.weekNumber}><div className={styles.weekNumber}>W{week.weekNumber}</div><div className={styles.weekFields}><input value={week.title} onChange={(event) => setWeeks((current) => current.map((item) => item.weekNumber === week.weekNumber ? { ...item, title: event.target.value } : item))} placeholder={`Week ${week.weekNumber} topic / focus`} /><textarea value={week.summary} onChange={(event) => setWeeks((current) => current.map((item) => item.weekNumber === week.weekNumber ? { ...item, summary: event.target.value } : item))} placeholder="What should be covered this week?" rows={2} /></div></article>)}</div>
        <div className={styles.saveBar}><span>Fill the weeks, switch subjects, then save.</span><button type="button" className="btn btn-primary" onClick={() => void saveWeeks()} disabled={busy}>{busy ? "Saving…" : "Save weekly plan"}</button></div>
      </section>}

      {!activePlan && <section className={styles.emptyEditor}><strong>Choose subjects above to start.</strong><span>Existing plans for this class will open automatically.</span></section>}
    </div>
  );
}
