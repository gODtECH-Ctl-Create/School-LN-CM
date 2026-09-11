import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import AcademicSetupClient, { type AcademicData } from "./academic-setup-client";
import SchoolCapabilitiesClient from "./school-capabilities-client";
import "./academic.module.css";
import { createClient } from "@/src/lib/supabase/server";

export default async function AcademicSetupPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase.from("school_memberships").select("school_id, role").eq("user_id", auth.user.id).eq("is_active", true).in("role", ["school_admin", "academic_coordinator", "platform_admin"]).limit(1).maybeSingle();
  if (!membership) redirect("/");

  const { data: schools } = await supabase.from("schools").select("id, name, code, capabilities").eq("id", membership.school_id).order("name");
  const school = schools?.[0];
  if (!school) redirect("/");

  const [{ data: sessions }, { data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("academic_sessions").select("id, name, starts_on, ends_on, is_current").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("classes").select("id, name, level").eq("school_id", school.id).order("name"),
    supabase.from("subjects").select("id, name, code").eq("school_id", school.id).order("name"),
  ]);

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: terms } = sessionIds.length ? await supabase.from("terms").select("id, academic_session_id, name, term_number, starts_on, ends_on, is_current").in("academic_session_id", sessionIds).order("term_number") : { data: [] };

  const initialData: AcademicData = { schools: schools ?? [], school, sessions: sessions ?? [], terms: terms ?? [], classes: classes ?? [], subjects: subjects ?? [] };

  return (
    <AppShell role={membership.role} schoolName={school.name} schoolCode={school.code} userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined} active="academic">
      <div className="page-wrap">
        <SchoolCapabilitiesClient schoolId={school.id} initialCapabilities={school.capabilities ?? []} />
        <AcademicSetupClient initialData={initialData} />
      </div>
    </AppShell>
  );
}
