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

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, code")
    .eq("id", membership.school_id)
    .maybeSingle();
  if (!school) redirect("/");

  const [{ data: assignments }, { data: notes }] = await Promise.all([
    supabase
      .from("teacher_assignments")
      .select("class_id, subject_id, academic_session_id")
      .eq("membership_id", membership.id),
    supabase
      .from("lesson_notes")
      .select("id, curriculum_id, curriculum_unit_id, curriculum_topic_id, academic_session_id, term_id, class_id, subject_id, title, duration_minutes, learning_objectives, lesson_introduction, lesson_content, teacher_activities, learner_activities, assessment, homework, materials, status, created_at, updated_at")
      .eq("teacher_membership_id", membership.id)
      .order("updated_at", { ascending: false }),
  ]);

  const classIds = [...new Set([...(assignments ?? []).map((item) => item.class_id), ...(notes ?? []).map((item) => item.class_id)])];
  const subjectIds = [...new Set([...(assignments ?? []).map((item) => item.subject_id), ...(notes ?? []).map((item) => item.subject_id)])];
  const sessionIds = [...new Set([...(assignments ?? []).map((item) => item.academic_session_id), ...(notes ?? []).map((item) => item.academic_session_id)])];
  const termIds = [...new Set((notes ?? []).map((item) => item.term_id))];
  const topicIds = [...new Set((notes ?? []).map((item) => item.curriculum_topic_id).filter(Boolean) as string[])];

  const [{ data: classes }, { data: subjects }, { data: sessions }, { data: terms }, { data: topics }] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, name, level").in("id", classIds).order("name") : Promise.resolve({ data: [] }),
    subjectIds.length ? supabase.from("subjects").select("id, name, code").in("id", subjectIds).order("name") : Promise.resolve({ data: [] }),
    sessionIds.length ? supabase.from("academic_sessions").select("id, name, is_current").in("id", sessionIds).order("starts_on", { ascending: false }) : Promise.resolve({ data: [] }),
    termIds.length ? supabase.from("terms").select("id, academic_session_id, name, term_number, is_current").in("id", termIds) : Promise.resolve({ data: [] }),
    topicIds.length ? supabase.from("curriculum_topics").select("id, unit_id, title, week_number, lesson_count").in("id", topicIds) : Promise.resolve({ data: [] }),
  ]);

  const initialData: LessonWorkspaceData = {
    school,
    assignments: assignments ?? [],
    classes: classes ?? [],
    subjects: subjects ?? [],
    sessions: sessions ?? [],
    terms: terms ?? [],
    topics: topics ?? [],
    notes: notes ?? [],
  };

  return (
    <AppShell
      role="teacher"
      schoolName={school.name}
      schoolCode={school.code}
      userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined}
      active="lessons"
    >
      <div className="page-wrap">
        <TeacherLessonsClient initialData={initialData} />
      </div>
    </AppShell>
  );
}
