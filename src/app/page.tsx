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
    .select("id, school_id, role, is_head_teacher")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<{ id: string; school_id: string; role: AppRole; is_head_teacher: boolean }>();

  if (!membership) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true">SL</div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>You’re signed in.</h1>
          <p className="muted">Your account is ready, but it is not attached to an active school workspace yet.</p>
          <Link className="btn btn-secondary" href="/login">Return to sign in</Link>
        </section>
      </main>
    );
  }

  const [{ data: school }, { data: profile }, { data: currentSession }] = await Promise.all([
    supabase.from("schools").select("name, code").eq("id", membership.school_id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
    supabase.from("academic_sessions").select("name").eq("school_id", membership.school_id).eq("is_current", true).maybeSingle(),
  ]);

  const isAdmin = membership.role === "school_admin" || membership.role === "platform_admin";
  const isHeadTeacher = !isAdmin && membership.is_head_teacher === true;
  const firstName = profile?.display_name?.split(" ")[0] ?? auth.user.email?.split("@")[0] ?? "there";

  return (
    <AppShell
      role={membership.role}
      schoolName={school?.name ?? "Your school"}
      schoolCode={school?.code ?? "SCHOOL"}
      userName={profile?.display_name ?? auth.user.email ?? undefined}
      isHeadTeacher={isHeadTeacher}
      active="overview"
    >
      <div className="page-wrap">
        <section className="hero-row">
          <div>
            <p className="eyebrow">{isAdmin ? "ADMIN HOME" : isHeadTeacher ? "HEAD TEACHER" : "TEACHER HOME"}</p>
            <h1 className="page-title">Good morning, {firstName}.</h1>
            <p className="page-subtitle">
              {isAdmin
                ? "Run the school from one place. Add people, publish curriculum and keep the teaching setup ready."
                : "Everything you need for teaching is kept close to the lesson you are working on."}
            </p>
            <div className="context-strip">
              <span className="context-chip"><strong>{school?.code ?? "SCHOOL"}</strong> {school?.name ?? "School"}</span>
              <span className="context-chip">Session <strong>{currentSession?.name ?? "Not configured"}</strong></span>
            </div>
          </div>
          <div className="context-strip" style={{ marginTop: 0 }}>
            {isAdmin ? (
              <>
                <Link className="btn btn-primary" href="/admin/staff">Add teacher <span aria-hidden="true">+</span></Link>
                <Link className="btn btn-secondary" href="/admin/curriculum">Create curriculum</Link>
              </>
            ) : (
              <Link className="btn btn-primary" href="/teacher/lessons">Prepare a lesson <span aria-hidden="true">→</span></Link>
            )}
          </div>
        </section>

        {isAdmin ? (
          <section className="dashboard-grid" style={{ marginTop: 6 }}>
            <article className="surface section-card">
              <div className="section-heading">
                <div><p className="eyebrow">PEOPLE</p><h2>Manage your teaching team</h2><p>Invite teachers, assign their classes and subjects, and control who has wider oversight.</p></div>
                <Link className="text-link" href="/admin/staff">Open people</Link>
              </div>
              <div className="lesson-list">
                <div className="lesson-row"><div className="lesson-time">01</div><div><div className="lesson-title">Add a teacher</div><div className="lesson-meta">Use the teacher’s real email. Their account is activated from the invitation.</div></div><Link className="btn btn-secondary" href="/admin/staff">Add</Link></div>
                <div className="lesson-row"><div className="lesson-time">02</div><div><div className="lesson-title">Assign teaching work</div><div className="lesson-meta">Give each teacher the class and subject context they need.</div></div><Link className="btn btn-secondary" href="/admin/staff">Assign</Link></div>
              </div>
            </article>
            <article className="surface section-card">
              <div className="section-heading">
                <div><p className="eyebrow">CURRICULUM</p><h2>Build the teaching path</h2><p>Create the curriculum once, then let teachers use it directly when preparing lessons.</p></div>
                <Link className="text-link" href="/admin/curriculum">Open curriculum</Link>
              </div>
              <div className="empty-state" style={{ minHeight: 142 }}>
                <strong>Keep it simple.</strong>
                <p style={{ margin: "6px 0 0" }}>Class → Subject → Term → Units → Topics → Publish.</p>
              </div>
            </article>
          </section>
        ) : (
          <section className="dashboard-grid" style={{ marginTop: 6 }}>
            <article className="surface section-card">
              <div className="section-heading">
                <div><p className="eyebrow">NEXT</p><h2>Your lesson workspace</h2><p>Start from your assigned teaching context and build the note without repeating school setup details.</p></div>
                <Link className="text-link" href="/teacher/lessons">Open lessons</Link>
              </div>
              <div className="lesson-list">
                <div className="lesson-row"><div className="lesson-time">START</div><div><div className="lesson-title">Prepare your next lesson</div><div className="lesson-meta">Choose a topic, generate what you need, edit it, then save the finished lesson note.</div></div><Link className="btn btn-secondary" href="/teacher/lessons">Prepare</Link></div>
                <div className="lesson-row"><div className="lesson-time">USE</div><div><div className="lesson-title">Open your curriculum</div><div className="lesson-meta">Pick a published topic and move straight into lesson preparation.</div></div><Link className="btn btn-secondary" href="/teacher/curriculum">Browse</Link></div>
              </div>
            </article>
            <article className="surface section-card">
              <div className="section-heading">
                <div><p className="eyebrow">YOUR ACCESS</p><h2>{isHeadTeacher ? "Head Teacher" : "Teacher"}</h2><p>{isHeadTeacher ? "You have the normal teacher workspace plus a Team area for monitoring other teachers." : "Your workspace stays focused on your own classes, curriculum and lessons."}</p></div>
              </div>
              <div className="context-strip" style={{ marginTop: 0 }}>
                <span className="context-chip">Role <strong>{isHeadTeacher ? "Head Teacher" : "Teacher"}</strong></span>
                {isHeadTeacher && <Link className="btn btn-secondary" href="/teacher/team">Open Team</Link>}
              </div>
            </article>
          </section>
        )}
      </div>
    </AppShell>
  );
}
