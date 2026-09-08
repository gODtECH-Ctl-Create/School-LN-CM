import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import TeacherCurriculumClient from "./teacher-curriculum-client";
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

  const { data: assignments } = await supabase.from("teacher_assignments").select("class_id, subject_id, academic_session_id").eq("membership_id", membership.id);
  const safeAssignments = assignments ?? [];

  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, academic_session_id, term_id, class_id, subject_id, title, description")
    .eq("school_id", membership.school_id)
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  const assignedCurricula = (curricula ?? []).filter((curriculum) => safeAssignments.some((assignment) => assignment.academic_session_id === curriculum.academic_session_id && assignment.class_id === curriculum.class_id && assignment.subject_id === curriculum.subject_id));

  const curriculumIds = assignedCurricula.map((item) => item.id);
  const { data: units } = curriculumIds.length ? await supabase.from("curriculum_units").select("id, curriculum_id, unit_number, title, summary, sort_order").in("curriculum_id", curriculumIds).order("sort_order") : { data: [] };
  const unitIds = (units ?? []).map((unit) => unit.id);
  const { data: topics } = unitIds.length ? await supabase.from("curriculum_topics").select("id, unit_id, title, summary, week_number, lesson_count, sort_order").in("unit_id", unitIds).order("sort_order") : { data: [] };

  const classIds = [...new Set(safeAssignments.map((item) => item.class_id))];
  const subjectIds = [...new Set(safeAssignments.map((item) => item.subject_id))];
  const sessionIds = [...new Set(safeAssignments.map((item) => item.academic_session_id))];
  const termIds = [...new Set(assignedCurricula.map((item) => item.term_id))];

  const [{ data: classes }, { data: subjects }, { data: sessions }, { data: terms }] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [] }),
    subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] }),
    sessionIds.length ? supabase.from("academic_sessions").select("id, name").in("id", sessionIds) : Promise.resolve({ data: [] }),
    termIds.length ? supabase.from("terms").select("id, name").in("id", termIds) : Promise.resolve({ data: [] }),
  ]);

  return (
    <AppShell role="teacher" schoolName={school.name} schoolCode={school.code} userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined} active="curriculum">
      <div className="page-wrap">
        <TeacherCurriculumClient
          data={{ school, curricula: assignedCurricula, units: units ?? [], topics: topics ?? [], classes: classes ?? [], subjects: subjects ?? [], sessions: sessions ?? [], terms: terms ?? [] }}
        />
      </div>
    </AppShell>
  );
}
