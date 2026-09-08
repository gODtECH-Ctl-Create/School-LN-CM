import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import TeacherLessonsClient, { type LessonWorkspaceData } from "./teacher-lessons-client";
import { createClient } from "@/src/lib/supabase/server";
import "./lessons.module.css";

export default async function TeacherLessonsPage() {
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

  const [{ data: assignments }, { data: notes }, { data: curricula }] = await Promise.all([
    supabase.from("teacher_assignments").select("class_id, subject_id, academic_session_id").eq("membership_id", membership.id),
    supabase.from("lesson_notes").select("id, curriculum_id, curriculum_unit_id, curriculum_topic_id, academic_session_id, term_id, class_id, subject_id, title, duration_minutes, learning_objectives, lesson_introduction, lesson_content, teacher_activities, learner_activities, assessment, homework, materials, status, created_at, updated_at").eq("teacher_membership_id", membership.id).order("updated_at", { ascending: false }),
    supabase.from("curricula").select("id, academic_session_id, term_id, class_id, subject_id").eq("school_id", membership.school_id).eq("status", "published"),
  ]);

  const safeAssignments = assignments ?? [];
  const safeCurricula = (curricula ?? []).filter((curriculum) => safeAssignments.some((assignment) => assignment.academic_session_id === curriculum.academic_session_id && assignment.class_id === curriculum.class_id && assignment.subject_id === curriculum.subject_id));
  const curriculumIds = safeCurricula.map((curriculum) => curriculum.id);
  const { data: units } = curriculumIds.length ? await supabase.from("curriculum_units").select("id, curriculum_id").in("curriculum_id", curriculumIds) : { data: [] };
  const unitIds = (units ?? []).map((unit) => unit.id);
  const { data: curriculumTopics } = unitIds.length ? await supabase.from("curriculum_topics").select("id, unit_id, title, week_number, lesson_count").in("unit_id", unitIds).order("sort_order") : { data: [] };
  const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]));
  const curriculumById = new Map(safeCurricula.map((curriculum) => [curriculum.id, curriculum]));
  const topics = (curriculumTopics ?? []).flatMap((topic) => {
    const unit = unitById.get(topic.unit_id);
    const curriculum = unit ? curriculumById.get(unit.curriculum_id) : undefined;
    return curriculum ? [{ ...topic, curriculum_id: curriculum.id, academic_session_id: curriculum.academic_session_id, term_id: curriculum.term_id, class_id: curriculum.class_id, subject_id: curriculum.subject_id }] : [];
  });

  const classIds = [...new Set([...(safeAssignments).map((item) => item.class_id), ...(notes ?? []).map((item) => item.class_id)])];
  const subjectIds = [...new Set([...(safeAssignments).map((item) => item.subject_id), ...(notes ?? []).map((item) => item.subject_id)])];
  const sessionIds = [...new Set([...(safeAssignments).map((item) => item.academic_session_id), ...(notes ?? []).map((item) => item.academic_session_id)])];
  const noteTermIds = [...new Set((notes ?? []).map((item) => item.term_id))];

  const [{ data: classes }, { data: subjects }, { data: sessions }, { data: terms }] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, name, level").in("id", classIds).order("name") : Promise.resolve({ data: [] }),
    subjectIds.length ? supabase.from("subjects").select("id, name, code").in("id", subjectIds).order("name") : Promise.resolve({ data: [] }),
    sessionIds.length ? supabase.from("academic_sessions").select("id, name, is_current").in("id", sessionIds).order("starts_on", { ascending: false }) : Promise.resolve({ data: [] }),
    noteTermIds.length ? supabase.from("terms").select("id, academic_session_id, name, term_number, is_current").in("id", noteTermIds) : Promise.resolve({ data: [] }),
  ]);

  const initialData: LessonWorkspaceData = {
    school,
    assignments: safeAssignments,
    classes: classes ?? [],
    subjects: subjects ?? [],
    sessions: sessions ?? [],
    terms: terms ?? [],
    topics,
    notes: notes ?? [],
  };

  return (
    <AppShell role="teacher" schoolName={school.name} schoolCode={school.code} userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined} active="lessons">
      <div className="page-wrap"><TeacherLessonsClient initialData={initialData} /></div>
    </AppShell>
  );
}
