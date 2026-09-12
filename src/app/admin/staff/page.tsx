import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import StaffManagementClient, { type StaffData } from "./staff-management-client";
import { createClient } from "@/src/lib/supabase/server";

export default async function StaffManagementPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("school_id, role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .in("role", ["school_admin", "platform_admin"])
    .limit(1)
    .maybeSingle<{ school_id: string; role: "school_admin" | "platform_admin" }>();

  if (!membership) redirect("/");

  const { data: schools } = await supabase
    .from("schools")
    .select("id, name, code")
    .eq("id", membership.school_id)
    .order("name");
  if (!schools?.length) redirect("/");

  const school = schools[0];
  const [{ data: classes }, { data: subjects }, { data: sessions }, { data: invitations }, { data: teacherMemberships }] = await Promise.all([
    supabase.from("classes").select("id, name, level").eq("school_id", school.id).order("name"),
    supabase.from("subjects").select("id, name, code").eq("school_id", school.id).order("name"),
    supabase.from("academic_sessions").select("id, name, is_current").eq("school_id", school.id).order("starts_on", { ascending: false }),
    supabase.from("staff_invitations").select("id, email, first_name, last_name, role, staff_code, status, expires_at, accepted_at, created_at").eq("school_id", school.id).order("created_at", { ascending: false }),
    supabase.from("school_memberships").select("id, is_head_teacher").eq("school_id", school.id).eq("role", "teacher").eq("is_active", true).order("created_at", { ascending: true }),
  ]);

  const teacherIds = (teacherMemberships ?? []).map((teacher) => teacher.id);
  const [{ data: staffProfiles }, { data: assignments }] = await Promise.all([
    teacherIds.length ? supabase.from("staff_profiles").select("membership_id, first_name, last_name, staff_code").in("membership_id", teacherIds) : Promise.resolve({ data: [] }),
    teacherIds.length ? supabase.from("teacher_assignments").select("membership_id, class_id, subject_id, academic_session_id").in("membership_id", teacherIds) : Promise.resolve({ data: [] }),
  ]);

  const initialData: StaffData = {
    schools,
    school,
    classes: classes ?? [],
    subjects: subjects ?? [],
    sessions: sessions ?? [],
    invitations: invitations ?? [],
    teachers: (teacherMemberships ?? []).map((teacher) => {
      const profile = (staffProfiles ?? []).find((item) => item.membership_id === teacher.id);
      return {
        membershipId: teacher.id,
        firstName: profile?.first_name ?? "Teacher",
        lastName: profile?.last_name ?? "",
        staffCode: profile?.staff_code ?? "",
        isHeadTeacher: teacher.is_head_teacher,
        assignments: (assignments ?? []).filter((assignment) => assignment.membership_id === teacher.id).length,
      };
    }),
  };

  return (
    <AppShell
      role={membership.role}
      schoolName={school.name}
      schoolCode={school.code}
      userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined}
      active="staff"
    >
      <div className="page-wrap">
        <StaffManagementClient initialData={initialData} />
      </div>
    </AppShell>
  );
}
