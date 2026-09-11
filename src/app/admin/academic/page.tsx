import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import AcademicSetupV3, { type AcademicDataV3 } from "./academic-setup-v3";
import SchoolCapabilitiesClient from "./school-capabilities-client";
import "./academic.module.css";
import { createClient } from "@/src/lib/supabase/server";

export default async function AcademicSetupPage() {
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

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, code, capabilities")
    .eq("id", membership.school_id)
    .maybeSingle();
  if (!school) redirect("/");

  const [{ data: sessions }, { data: terms }, { data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("academic_sessions").select("id, name, starts_on, ends_on, is_current").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("terms").select("id, academic_session_id, name, term_number, starts_on, ends_on, is_current").order("term_number"),
    supabase.from("classes").select("id, name, level").eq("school_id", school.id).eq("is_active", true).order("name"),
    supabase.from("subjects").select("id, name, code").eq("school_id", school.id).order("name"),
  ]);

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const filteredTerms = (terms ?? []).filter((term) => sessionIds.includes(term.academic_session_id));
  const classIds = (classes ?? []).map((item) => item.id);
  const { data: classSubjectLinks } = classIds.length
    ? await supabase.from("class_subjects").select("class_id, subject_id").in("class_id", classIds)
    : { data: [] as { class_id: string; subject_id: string }[] };

  const subjectClassIds = new Map<string, string[]>();
  for (const link of classSubjectLinks ?? []) {
    subjectClassIds.set(link.subject_id, [...(subjectClassIds.get(link.subject_id) ?? []), link.class_id]);
  }

  const initialData: AcademicDataV3 = {
    school,
    sessions: sessions ?? [],
    terms: filteredTerms,
    classes: classes ?? [],
    subjects: subjects ?? [],
  };

  const structureData = {
    school: { id: school.id, capabilities: school.capabilities ?? [] },
    classes: classes ?? [],
    subjects: (subjects ?? []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      is_custom: false,
      class_ids: subjectClassIds.get(subject.id) ?? [],
    })),
  };

  return (
    <AppShell
      role={membership.role}
      schoolName={school.name}
      schoolCode={school.code}
      userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined}
      active="academic"
    >
      <div className="page-wrap">
        <SchoolCapabilitiesClient schoolId={school.id} initialCapabilities={school.capabilities ?? []} />
        <AcademicSetupV3 initialData={initialData} structureData={structureData} />
      </div>
    </AppShell>
  );
}
