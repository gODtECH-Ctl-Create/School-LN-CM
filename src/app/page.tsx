import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, type AppRole } from "@/src/components/app-shell";
import { createClient } from "@/src/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id, school_id, role")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<{ id: string; school_id: string; role: AppRole }>();

  if (!membership) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true">SL</div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>You’re signed in.</h1>
          <p className="muted">Your account does not have an active school membership yet. Ask your school administrator to finish your onboarding.</p>
          <Link className="btn btn-secondary" href="/login">Return to sign in</Link>
        </section>
      </main>
    );
  }

  const [{ data: school }, { data: profile }, { count: teachers }, { count: pendingInvites }, { data: currentSession }] = await Promise.all([
    supabase.from("schools").select("name, code").eq("id", membership.school_id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    supabase.from("school_memberships").select("id", { count: "exact", head: true }).eq("school_id", membership.school_id).eq("role", "teacher").eq("is_active", true),
    supabase.from("staff_invitations").select("id", { count: "exact", head: true }).eq("school_id", membership.school_id).eq("status", "pending"),
    supabase.from("academic_sessions").select("name").eq("school_id", membership.school_id).eq("is_current", true).maybeSingle(),
  ]);

  const role = membership.role;
  const isAdmin = role === "school_admin" || role === "platform_admin" || role === "academic_coordinator";
  const firstName = profile?.display_name?.split(" ")[0] ?? (auth.user.email?.split("@")[0] ?? "there");

  return (
    <AppShell
      role={role}
      schoolName={school?.name ?? "Your school"}
      schoolCode={school?.code ?? "SCHOOL"}
      userName={profile?.display_name ?? auth.user.email ?? undefined}
      active="overview"
    >
      <div className="page-wrap">
        <section className="hero-row">
          <div>
            <p className="eyebrow">{isAdmin ? "SCHOOL OVERVIEW" : "TEACHER WORKSPACE"}</p>
            <h1 className="page-title">Good morning, {firstName}.</h1>
            <p className="page-subtitle">{isAdmin ? "Keep your school's people, academic setup and teaching operations organised from one place." : "Your teaching workspace keeps the class, subject and curriculum context close to the lesson you’re preparing."}</p>
            <div className="context-strip">
              <span className="context-chip"><strong>{school?.code ?? "SCHOOL"}</strong> {school?.name ?? "School"}</span>
              <span className="context-chip">Session <strong>{currentSession?.name ?? "Not configured"}</strong></span>
            </div>
          </div>
          {isAdmin && <Link className="btn btn-primary workspace-quick-action" href="/admin/staff">Add a teacher <span aria-hidden="true">→</span></Link>}
        </section>

        {isAdmin ? (
          <>
            <section className="grid-3" aria-label="School summary">
              <article className="surface stat-card"><span className="stat-label">Active teachers</span><div className="stat-value">{teachers ?? 0}</div><div className="stat-note">Teachers currently active in this school.</div></article>
              <article className="surface stat-card"><span className="stat-label">Pending invitations</span><div className="stat-value">{pendingInvites ?? 0}</div><div className="stat-note">Invited teachers who have not completed setup.</div></article>
              <article className="surface stat-card"><span className="stat-label">Academic session</span><div className="stat-value" style={{ fontSize: 21 }}>{currentSession?.name ?? "Setup needed"}</div><div className="stat-note">Current school session used by academic work.</div></article>
            </section>

            <section className="dashboard-grid">
              <article className="surface section-card">
                <div className="section-heading"><div><h2>Staff operations</h2><p>Invite teachers, attach their teaching assignments and track onboarding.</p></div><Link className="text-link" href="/admin/staff">Open staff</Link></div>
                <div className="lesson-list">
                  <div className="lesson-row"><div className="lesson-time">NEXT</div><div><div className="lesson-title">Invite a teacher</div><div className="lesson-meta">Use the teacher’s real email address. The school Staff ID is generated automatically.</div></div><Link className="btn btn-secondary" href="/admin/staff">Start</Link></div>
                  <div className="lesson-row"><div className="lesson-time">CHECK</div><div><div className="lesson-title">Review invitations</div><div className="lesson-meta">Pending memberships stay inactive until account setup is complete.</div></div><Link className="btn btn-secondary" href="/admin/staff">Review</Link></div>
                </div>
              </article>
              <article className="surface section-card">
                <div className="section-heading"><div><h2>Academic setup</h2><p>Get the teaching context ready before curriculum work begins.</p></div></div>
                <div className="progress-row"><div className="progress-label"><span>Foundation</span><strong>In progress</strong></div><div className="progress-track"><div className="progress-bar" style={{ width: "42%" }} /></div></div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>School, staff and session foundations are available. Curriculum and lesson workflows are the next product layer.</p>
              </article>
            </section>
          </>
        ) : (
          <>
            <section className="grid-3" aria-label="Teacher workspace summary">
              <article className="surface stat-card"><span className="stat-label">Today’s lessons</span><div className="stat-value">0</div><div className="stat-note">No lesson schedule has been connected yet.</div></article>
              <article className="surface stat-card"><span className="stat-label">Preparation</span><div className="stat-value">0%</div><div className="stat-note">Preparation tracking begins with your lesson workflow.</div></article>
              <article className="surface stat-card"><span className="stat-label">Current session</span><div className="stat-value" style={{ fontSize: 21 }}>{currentSession?.name ?? "Setup needed"}</div><div className="stat-note">Academic context for your teaching work.</div></article>
            </section>
            <section className="dashboard-grid">
              <article className="surface section-card"><div className="section-heading"><div><h2>Today’s teaching plan</h2><p>Your next lessons will appear here once the academic schedule is connected.</p></div></div><div className="empty-state">No lessons are scheduled for this workspace yet. Once classes, subjects and curriculum planning are connected, this becomes your daily teaching queue.</div></article>
              <article className="surface section-card"><div className="section-heading"><div><h2>Lesson preparation</h2><p>Keep the lesson context visible from planning to delivery.</p></div></div><div className="context-strip" style={{ marginTop: 0 }}><span className="context-chip">Class <strong>Not assigned</strong></span><span className="context-chip">Subject <strong>Not assigned</strong></span><span className="context-chip">Week <strong>Not assigned</strong></span></div><p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Your workspace is ready for the next curriculum and lesson-note layer.</p></article>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
