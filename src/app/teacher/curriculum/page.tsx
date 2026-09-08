import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import { createClient } from "@/src/lib/supabase/server";

export default async function TeacherCurriculumPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id, school_id, role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .eq("role", "teacher")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/");

  const { data: school } = await supabase.from("schools").select("id, name, code").eq("id", membership.school_id).maybeSingle();
  if (!school) redirect("/");

  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("class_id, subject_id, academic_session_id")
    .eq("membership_id", membership.id);

  const safeAssignments = assignments ?? [];
  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, academic_session_id, term_id, class_id, subject_id, title, description, status")
    .eq("school_id", school.id)
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  const assignedCurricula = (curricula ?? []).filter((curriculum) => safeAssignments.some((assignment) => assignment.academic_session_id === curriculum.academic_session_id && assignment.class_id === curriculum.class_id && assignment.subject_id === curriculum.subject_id));
  const curriculumIds = assignedCurricula.map((item) => item.id);
  const { data: units } = curriculumIds.length ? await supabase.from("curriculum_units").select("id, curriculum_id, unit_number, title, summary, sort_order").in("curriculum_id", curriculumIds).order("sort_order") : { data: [] };
  const unitIds = (units ?? []).map((unit) => unit.id);
  const { data: topics } = unitIds.length ? await supabase.from("curriculum_topics").select("id, unit_id, title, summary, week_number, lesson_count, sort_order").in("unit_id", unitIds).order("sort_order") : { data: [] };
  const { data: classes } = safeAssignments.length ? await supabase.from("classes").select("id, name").in("id", [...new Set(safeAssignments.map((item) => item.class_id))]) : { data: [] };
  const { data: subjects } = safeAssignments.length ? await supabase.from("subjects").select("id, name").in("id", [...new Set(safeAssignments.map((item) => item.subject_id))]) : { data: [] };
  const { data: sessions } = safeAssignments.length ? await supabase.from("academic_sessions").select("id, name").in("id", [...new Set(safeAssignments.map((item) => item.academic_session_id))]) : { data: [] };
  const { data: terms } = assignedCurricula.length ? await supabase.from("terms").select("id, name").in("id", [...new Set(assignedCurricula.map((item) => item.term_id))]) : { data: [] };

  const classMap = new Map((classes ?? []).map((item) => [item.id, item.name]));
  const subjectMap = new Map((subjects ?? []).map((item) => [item.id, item.name]));
  const sessionMap = new Map((sessions ?? []).map((item) => [item.id, item.name]));
  const termMap = new Map((terms ?? []).map((item) => [item.id, item.name]));
  const unitsByCurriculum = new Map<string, typeof units>();
  for (const unit of units ?? []) unitsByCurriculum.set(unit.curriculum_id, [...(unitsByCurriculum.get(unit.curriculum_id) ?? []), unit]);
  const topicsByUnit = new Map<string, typeof topics>();
  for (const topic of topics ?? []) topicsByUnit.set(topic.unit_id, [...(topicsByUnit.get(topic.unit_id) ?? []), topic]);

  return (
    <AppShell role="teacher" schoolName={school.name} schoolCode={school.code} userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined} active="curriculum">
      <div className="page-wrap">
        <section className="page-heading">
          <div>
            <p className="eyebrow">MY CURRICULUM</p>
            <h1>See the path before the lesson.</h1>
            <p className="muted">Browse the published curriculum for your assigned classes and subjects, then jump into lesson preparation when you are ready.</p>
            <div className="context-strip"><span className="context-chip"><strong>{school.code}</strong> {school.name}</span><span className="context-chip">Published plans <strong>{assignedCurricula.length}</strong></span></div>
          </div>
          <Link className="btn btn-primary" href="/teacher/lessons">Open lesson workspace <span aria-hidden="true">→</span></Link>
        </section>

        <section className="surface teacher-curriculum-summary">
          <div className="summary-item"><span>Assigned classes</span><strong>{new Set(safeAssignments.map((item) => item.class_id)).size}</strong></div>
          <div className="summary-item"><span>Subjects</span><strong>{new Set(safeAssignments.map((item) => item.subject_id)).size}</strong></div>
          <div className="summary-item"><span>Published topics</span><strong>{topics?.length ?? 0}</strong></div>
        </section>

        <section className="teacher-curriculum-grid">
          {assignedCurricula.length ? assignedCurricula.map((curriculum) => (
            <article className="surface teacher-curriculum-card" key={curriculum.id}>
              <header className="teacher-curriculum-card-header">
                <div>
                  <p className="eyebrow">{termMap.get(curriculum.term_id) ?? "Term"} · {sessionMap.get(curriculum.academic_session_id) ?? "Session"}</p>
                  <h2>{curriculum.title}</h2>
                  <p>{classMap.get(curriculum.class_id) ?? "Class"} · {subjectMap.get(curriculum.subject_id) ?? "Subject"}</p>
                </div>
                <span className="status status-accepted">Published</span>
              </header>
              {curriculum.description && <p className="teacher-curriculum-description">{curriculum.description}</p>}
              <div className="teacher-unit-list">
                {(unitsByCurriculum.get(curriculum.id) ?? []).length ? (unitsByCurriculum.get(curriculum.id) ?? []).map((unit) => {
                  const unitTopics = topicsByUnit.get(unit.id) ?? [];
                  return <section className="teacher-unit" key={unit.id}><div className="teacher-unit-heading"><span className="unit-number">{unit.unit_number}</span><div><strong>{unit.title}</strong><p>{unit.summary || "No unit summary yet."}</p></div><span>{unitTopics.length} topic{unitTopics.length === 1 ? "" : "s"}</span></div>{unitTopics.length ? <div className="teacher-topic-list">{unitTopics.map((topic) => <div className="teacher-topic" key={topic.id}><span className="topic-week">{topic.week_number ? `W${topic.week_number}` : "--"}</span><div><strong>{topic.title}</strong><p>{topic.summary || ""}</p></div><span>{topic.lesson_count} lesson{topic.lesson_count === 1 ? "" : "s"}</span><Link className="button-secondary" href="/teacher/lessons">Prepare</Link></div>)}</div> : <div className="empty-state">This unit has no topics yet.</div>}</section>;
                }) : <div className="empty-state"><strong>Units are not ready yet.</strong><p>This curriculum is published but needs its teaching sequence completed.</p></div>}
              </div>
            </article>
          )) : <div className="surface teacher-curriculum-empty"><div className="editor-mark">C</div><p className="eyebrow">PUBLISHED CURRICULUM</p><h2>Your published teaching path will appear here.</h2><p className="muted">Once an administrator publishes a curriculum for one of your assigned class and subject combinations, you will be able to browse its units and topics from this page.</p><Link className="btn btn-secondary" href="/teacher/lessons">Go to lesson workspace</Link></div>}
        </section>
      </div>

      <style jsx global>{`
        .teacher-curriculum-summary { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 1px; overflow: hidden; margin-bottom: 16px; }
        .summary-item { padding: 18px 20px; background: #fff; }
        .summary-item + .summary-item { border-left: 1px solid var(--line); }
        .summary-item span { display: block; color: var(--muted); font-size: 10px; font-weight: 800; }
        .summary-item strong { display: block; margin-top: 7px; font-size: 24px; letter-spacing: -.03em; }
        .teacher-curriculum-grid { display: grid; gap: 16px; }
        .teacher-curriculum-card { padding: 22px; }
        .teacher-curriculum-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .teacher-curriculum-card-header h2 { margin: 0; font-size: 21px; letter-spacing: -.03em; }
        .teacher-curriculum-card-header p:not(.eyebrow) { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
        .teacher-curriculum-description { max-width: 760px; margin: 14px 0 0; color: var(--ink-soft); font-size: 12px; line-height: 1.6; }
        .teacher-unit-list { display: grid; gap: 9px; margin-top: 18px; }
        .teacher-unit { padding: 13px; border: 1px solid var(--line); border-radius: 13px; background: var(--surface-soft); }
        .teacher-unit-heading { display: grid; grid-template-columns: 32px minmax(0,1fr) auto; gap: 10px; align-items: center; }
        .teacher-unit-heading strong { font-size: 12px; }
        .teacher-unit-heading p { margin: 3px 0 0; color: var(--muted); font-size: 10px; }
        .teacher-unit-heading > span:last-child { color: var(--muted); font-size: 9px; white-space: nowrap; }
        .teacher-topic-list { display: grid; gap: 7px; margin-top: 9px; }
        .teacher-topic { display: grid; grid-template-columns: 38px minmax(0,1fr) auto auto; gap: 9px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 11px; background: #fff; }
        .teacher-topic strong { font-size: 11px; }
        .teacher-topic p { margin: 3px 0 0; color: var(--muted); font-size: 9px; }
        .teacher-topic > span:last-of-type { color: var(--muted); font-size: 9px; white-space: nowrap; }
        .teacher-curriculum-empty { min-height: 430px; padding: 30px; display: grid; align-content: center; justify-items: start; max-width: 720px; }
        .teacher-curriculum-empty h2 { margin: 0 0 9px; font-size: 27px; letter-spacing: -.04em; }
        @media (max-width: 760px) { .teacher-curriculum-summary { grid-template-columns: 1fr; } .summary-item + .summary-item { border-left: 0; border-top: 1px solid var(--line); } .teacher-curriculum-card { padding: 16px; } .teacher-curriculum-card-header { flex-direction: column; } .teacher-topic { grid-template-columns: 36px minmax(0,1fr); } .teacher-topic > span:last-of-type, .teacher-topic .button-secondary { grid-column: 2; justify-self: start; } }
      `}</style>
    </AppShell>
  );
}
