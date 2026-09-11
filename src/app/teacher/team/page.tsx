import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import { createClient } from "@/src/lib/supabase/server";

export default async function TeacherTeamPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id, school_id, is_head_teacher")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .eq("role", "teacher")
    .limit(1)
    .maybeSingle();

  if (!membership?.is_head_teacher) redirect("/");

  const { data: school } = await supabase.from("schools").select("id, name, code").eq("id", membership.school_id).maybeSingle();
  if (!school) redirect("/");

  const { data: teachers } = await supabase
    .from("school_memberships")
    .select("id, user_id, is_head_teacher")
    .eq("school_id", membership.school_id)
    .eq("is_active", true)
    .eq("role", "teacher")
    .order("created_at", { ascending: true });

  const teacherMemberships = teachers ?? [];
  const teacherIds = teacherMemberships.map((teacher) => teacher.id);
  const userIds = teacherMemberships.map((teacher) => teacher.user_id);
  const [{ data: profiles }, { data: staffProfiles }, { data: assignments }, { data: notes }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [] }),
    teacherIds.length ? supabase.from("staff_profiles").select("membership_id, first_name, last_name, staff_code").in("membership_id", teacherIds) : Promise.resolve({ data: [] }),
    teacherIds.length ? supabase.from("teacher_assignments").select("membership_id, class_id, subject_id").in("membership_id", teacherIds) : Promise.resolve({ data: [] }),
    teacherIds.length ? supabase.from("lesson_notes").select("id, teacher_membership_id, status").in("teacher_membership_id", teacherIds) : Promise.resolve({ data: [] }),
  ]);

  const teacherCards = teacherMemberships.map((teacher) => {
    const staff = (staffProfiles ?? []).find((item) => item.membership_id === teacher.id);
    const profile = (profiles ?? []).find((item) => item.id === teacher.user_id);
    const teacherAssignments = (assignments ?? []).filter((item) => item.membership_id === teacher.id);
    const teacherNotes = (notes ?? []).filter((item) => item.teacher_membership_id === teacher.id);
    return {
      ...teacher,
      name: staff ? `${staff.first_name} ${staff.last_name}` : profile?.display_name ?? "Teacher",
      staffCode: staff?.staff_code ?? "",
      assignments: teacherAssignments.length,
      lessons: teacherNotes.length,
      published: teacherNotes.filter((note) => note.status === "published").length,
    };
  });

  return (
    <AppShell
      role="teacher"
      schoolName={school.name}
      schoolCode={school.code}
      userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined}
      isHeadTeacher
      active="team"
    >
      <div className="page-wrap">
        <section className="page-heading">
          <div>
            <p className="eyebrow">TEAM</p>
            <h1>See how the team is doing.</h1>
            <p className="muted">A simple view for Head Teachers. Monitor teaching activity without changing anyone’s normal teacher workspace.</p>
            <div className="context-strip"><span className="context-chip"><strong>{school.code}</strong> {school.name}</span><span className="context-chip">Teachers <strong>{teacherCards.length}</strong></span></div>
          </div>
        </section>

        <section className="surface section-card">
          {teacherCards.length ? (
            <div className="invitation-list">
              {teacherCards.map((teacher) => (
                <article className="invitation-card" key={teacher.id}>
                  <div className="invitation-person">
                    <span className="avatar avatar-soft" aria-hidden="true">{teacher.name.split(" ").map((part: string) => part.charAt(0)).slice(0, 2).join("")}</span>
                    <div>
                      <strong>{teacher.name}</strong>
                      <p>{teacher.staffCode}{teacher.is_head_teacher ? " · Head Teacher" : " · Teacher"}</p>
                      <span>{teacher.assignments} assignment{teacher.assignments === 1 ? "" : "s"} · {teacher.lessons} lesson{teacher.lessons === 1 ? "" : "s"} · {teacher.published} published</span>
                    </div>
                  </div>
                  <span className={`status ${teacher.is_head_teacher ? "status-accepted" : "status-provisioning"}`}>{teacher.is_head_teacher ? "Head Teacher" : "Teacher"}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><strong>No teachers yet.</strong><p>The teaching team will appear here as teachers join the school.</p></div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
