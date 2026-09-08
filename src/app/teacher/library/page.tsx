import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/app-shell";
import { createClient } from "@/src/lib/supabase/server";

function statusClass(status: "draft" | "published" | "archived") {
  return status === "published" ? "status-accepted" : status === "archived" ? "status-revoked" : "status-provisioning";
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function TeacherLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
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

  const { data: notes } = await supabase
    .from("lesson_notes")
    .select("id, academic_session_id, term_id, class_id, subject_id, title, learning_objectives, lesson_content, status, duration_minutes, updated_at")
    .eq("teacher_membership_id", membership.id)
    .order("updated_at", { ascending: false });

  const safeNotes = (notes ?? []).filter((note) => {
    if (!query) return true;
    return [note.title, note.learning_objectives ?? "", note.lesson_content ?? ""].some((value) => value.toLowerCase().includes(query));
  });

  const classIds = [...new Set((notes ?? []).map((note) => note.class_id))];
  const subjectIds = [...new Set((notes ?? []).map((note) => note.subject_id))];
  const sessionIds = [...new Set((notes ?? []).map((note) => note.academic_session_id))];
  const termIds = [...new Set((notes ?? []).map((note) => note.term_id))];
  const [{ data: classes }, { data: subjects }, { data: sessions }, { data: terms }] = await Promise.all([
    classIds.length ? supabase.from("classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [] }),
    subjectIds.length ? supabase.from("subjects").select("id, name").in("id", subjectIds) : Promise.resolve({ data: [] }),
    sessionIds.length ? supabase.from("academic_sessions").select("id, name").in("id", sessionIds) : Promise.resolve({ data: [] }),
    termIds.length ? supabase.from("terms").select("id, name").in("id", termIds) : Promise.resolve({ data: [] }),
  ]);

  const classMap = new Map((classes ?? []).map((item) => [item.id, item.name]));
  const subjectMap = new Map((subjects ?? []).map((item) => [item.id, item.name]));
  const sessionMap = new Map((sessions ?? []).map((item) => [item.id, item.name]));
  const termMap = new Map((terms ?? []).map((item) => [item.id, item.name]));

  return (
    <AppShell role="teacher" schoolName={school.name} schoolCode={school.code} userName={auth.user.user_metadata?.full_name ?? auth.user.email ?? undefined} active="library">
      <div className="page-wrap">
        <section className="page-heading">
          <div>
            <p className="eyebrow">LESSON LIBRARY</p>
            <h1>Everything you’ve prepared, in one place.</h1>
            <p className="muted">Search your lesson notes, reopen a draft, or reuse a published note as the starting point for your next teaching session.</p>
            <div className="context-strip"><span className="context-chip"><strong>{school.code}</strong> {school.name}</span><span className="context-chip">Saved notes <strong>{notes?.length ?? 0}</strong></span></div>
          </div>
          <Link className="btn btn-primary" href="/teacher/lessons">Create lesson note <span aria-hidden="true">+</span></Link>
        </section>

        <section className="surface library-toolbar">
          <form action="/teacher/library" method="get" className="library-search">
            <label className="field">Search lesson notes<input type="search" name="q" defaultValue={params.q ?? ""} placeholder="Search by lesson title or content" /></label>
            <button className="btn btn-secondary" type="submit">Search</button>
          </form>
          {query && <p className="library-result-note">Showing {safeNotes.length} result{safeNotes.length === 1 ? "" : "s"} for <strong>“{params.q}”</strong>.</p>}
        </section>

        <section className="library-grid" aria-label="Lesson notes">
          {safeNotes.length ? safeNotes.map((note) => (
            <article className="surface library-card" key={note.id}>
              <header className="library-card-header">
                <div><p className="eyebrow">{termMap.get(note.term_id) ?? "Term"} · {sessionMap.get(note.academic_session_id) ?? "Session"}</p><h2>{note.title}</h2></div><span className={`status ${statusClass(note.status)}`}>{note.status}</span></header>
              <div className="library-context"><span>{classMap.get(note.class_id) ?? "Class"}</span><span>{subjectMap.get(note.subject_id) ?? "Subject"}</span><span>{note.duration_minutes} min</span></div>
              <p className="library-preview">{note.lesson_content?.trim() || note.learning_objectives?.trim() || "This lesson note has not been filled out yet."}</p>
              <footer className="library-card-footer"><span>Updated {formatUpdated(note.updated_at)}</span><Link className="btn btn-secondary" href={`/teacher/lessons?lesson=${encodeURIComponent(note.id)}`}>Open note</Link></footer>
            </article>
          )) : (
            <div className="surface library-empty"><div className="editor-mark">L</div><p className="eyebrow">LESSON LIBRARY</p><h2>{query ? "No notes match that search." : "Your lesson library is empty."}</h2><p className="muted">{query ? "Try another phrase or search by the main teaching topic." : "Create your first lesson note from an assigned class and subject. Saved notes will appear here automatically."}</p><Link className="btn btn-primary" href="/teacher/lessons">Create your first lesson</Link></div>
          )}
        </section>
      </div>

      <style jsx global>{`
        .library-toolbar { padding: 18px; margin-bottom: 16px; }
        .library-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
        .library-result-note { margin: 10px 0 0; color: var(--muted); font-size: 10px; }
        .library-result-note strong { color: var(--ink-soft); }
        .library-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
        .library-card { min-width: 0; padding: 19px; }
        .library-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .library-card-header h2 { margin: 0; font-size: 17px; letter-spacing: -.025em; }
        .library-context { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
        .library-context span { padding: 5px 8px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 9px; font-weight: 750; background: var(--surface-soft); }
        .library-preview { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; margin: 14px 0; color: var(--ink-soft); font-size: 11px; line-height: 1.65; min-height: 73px; }
        .library-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 13px; border-top: 1px solid var(--line); color: var(--muted); font-size: 9px; }
        .library-empty { grid-column: 1 / -1; min-height: 420px; padding: 30px; display: grid; align-content: center; justify-items: start; max-width: 720px; }
        .library-empty h2 { margin: 0 0 8px; font-size: 28px; letter-spacing: -.04em; }
        @media (max-width: 760px) { .library-search, .library-grid { grid-template-columns: 1fr; } .library-card-header, .library-card-footer { align-items: stretch; flex-direction: column; } }
      `}</style>
    </AppShell>
  );
}
