import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import CurriculumBuilderClient, { type CurriculumBuilderData } from "./curriculum-builder-v2";
import { createClient } from "@/src/lib/supabase/server";

export default async function CurriculumPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("school_id, role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .in("role", ["school_admin", "academic_coordinator", "platform_admin"])
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/");

  const { data: school } = await supabase.from("schools").select("id, name, code").eq("id", membership.school_id).maybeSingle();
  if (!school) redirect("/");

  const [{ data: sessions }, { data: terms }, { data: classes }, { data: subjects }, { data: curricula }] = await Promise.all([
    supabase.from("academic_sessions").select("id, name, starts_on, ends_on, is_current").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("terms").select("id, academic_session_id, name, term_number, starts_on, ends_on, is_current").order("term_number"),
    supabase.from("classes").select("id, name, level").eq("school_id", school.id).order("name"),
    supabase.from("subjects").select("id, name, code, is_custom").eq("school_id", school.id).order("is_custom").order("name"),
    supabase.from("curricula").select("id, academic_session_id, term_id, class_id, subject_id, title, description, status, week_count, topics_per_week").eq("school_id", school.id).order("updated_at", { ascending: false }),
  ]);

  const curriculumIds = (curricula ?? []).map((curriculum) => curriculum.id);
  const { data: units } = curriculumIds.length
    ? await supabase.from("curriculum_units").select("id, curriculum_id, unit_number, title").in("curriculum_id", curriculumIds).order("sort_order")
    : { data: [] };
  const unitIds = (units ?? []).map((unit) => unit.id);
  const { data: topics } = unitIds.length
    ? await supabase.from("curriculum_topics").select("id, unit_id, title, summary, week_number, topic_number, sort_order").in("unit_id", unitIds).order("sort_order")
    : { data: [] };

  const initialData: CurriculumBuilderData = {
    school,
    sessions: sessions ?? [],
    terms: (terms ?? []).filter((term) => (sessions ?? []).some((session) => session.id === term.academic_session_id)),
    classes: classes ?? [],
    subjects: subjects ?? [],
    curricula: (curricula ?? []).map((curriculum) => ({ ...curriculum, week_count: curriculum.week_count ?? 10, topics_per_week: curriculum.topics_per_week ?? 1 })),
    units: units ?? [],
    topics: topics ?? [],
  };

  return (
    <AppShell role={membership.role} schoolName={school.name} schoolCode={school.code} userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined} active="curriculum">
      <div className="page-wrap">
        <CurriculumBuilderClient initialData={initialData} />
      </div>
    </AppShell>
  );
}
