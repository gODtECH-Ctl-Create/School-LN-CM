import Link from "next/link";

export type AppRole = "platform_admin" | "school_admin" | "academic_coordinator" | "teacher" | "staff";

type AppShellProps = {
  children: React.ReactNode;
  role: AppRole;
  schoolName: string;
  schoolCode: string;
  userName?: string;
  isHeadTeacher?: boolean;
  active?: "overview" | "staff" | "academic" | "curriculum" | "lessons" | "library" | "team" | "settings";
};

const adminNavigation = [
  ["overview", "Home", "/", "H"],
  ["staff", "People", "/admin/staff", "P"],
  ["curriculum", "Curriculum", "/admin/curriculum", "C"],
  ["academic", "Setup", "/admin/academic", "S"],
] as const;

const teacherNavigation = [
  ["overview", "Today", "/", "T"],
  ["lessons", "Lessons", "/teacher/lessons", "L"],
  ["curriculum", "Curriculum", "/teacher/curriculum", "C"],
  ["library", "Library", "/teacher/library", "B"],
] as const;

export function AppShell({
  children,
  role,
  schoolName,
  schoolCode,
  userName,
  isHeadTeacher = false,
  active = "overview",
}: AppShellProps) {
  const isAdmin = role === "school_admin" || role === "platform_admin";
  const navigation = isAdmin
    ? adminNavigation
    : isHeadTeacher
      ? [...teacherNavigation, ["team", "Team", "/teacher/team", "T"] as const]
      : teacherNavigation;
  const displayName = userName?.trim() || (isAdmin ? "School administrator" : "Teacher");
  const accessLabel = isAdmin ? "Admin" : isHeadTeacher ? "Head Teacher" : "Teacher";

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Link href="/" className="app-brand" aria-label="School LN CM home">
          <span className="brand-mark brand-mark-small">SL</span>
          <span>
            <strong>School LN CM</strong>
            <small>Learning & curriculum</small>
          </span>
        </Link>

        <div className="school-context">
          <span className="school-context-label">School</span>
          <strong>{schoolName}</strong>
          <span>{schoolCode}</span>
        </div>

        <nav className="app-nav" aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {navigation.map(([key, label, href, mark]) => {
            const isActive = active === key;
            return (
              <Link
                className={`nav-item ${isActive ? "is-active" : ""}`}
                href={href}
                key={key}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{mark}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="nav-item is-disabled" aria-disabled="true">
            <span className="nav-icon" aria-hidden="true">?</span>
            Help & support
          </span>
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{accessLabel}</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="app-content">
        <header className="mobile-topbar">
          <Link href="/" className="mobile-brand" aria-label="School LN CM home">
            <span className="brand-mark brand-mark-small">SL</span>
            <span className="mobile-brand-copy">
              <strong>{schoolCode}</strong>
              <small>{accessLabel}</small>
            </span>
          </Link>
          <span className="mobile-user-name">{displayName}</span>
        </header>

        {children}

        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {navigation.map(([key, label, href, mark]) => {
            const isActive = active === key;
            return (
              <Link
                className={`mobile-nav-item ${isActive ? "is-active" : ""}`}
                href={href}
                key={key}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="mobile-nav-icon" aria-hidden="true">{mark}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
      <style jsx global>{`
        .mobile-bottom-nav { display: none; }
        @media (max-width: 1024px) {
          .app-frame { display: block; min-height: 100svh; }
          .app-sidebar { display: none; }
          .app-content { width: 100%; padding: 0 14px calc(78px + env(safe-area-inset-bottom)); }
          .mobile-topbar { position: sticky; top: 0; z-index: 20; min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 -14px; padding: 8px 14px; background: rgba(245,247,251,.94); border-bottom: 1px solid var(--line); backdrop-filter: blur(12px); }
          .mobile-brand { min-width: 0; }
          .mobile-brand-copy { min-width: 0; display: grid; gap: 1px; }
          .mobile-brand-copy strong { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .mobile-brand-copy small { color: var(--muted); font-size: 9px; font-weight: 800; }
          .mobile-user-name { max-width: 42%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 9px; font-weight: 800; }
          .mobile-bottom-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); padding: 7px 8px calc(7px + env(safe-area-inset-bottom)); background: rgba(255,255,255,.97); border-top: 1px solid var(--line); box-shadow: 0 -8px 24px rgba(16,24,40,.06); backdrop-filter: blur(14px); }
          .mobile-bottom-nav:has(.mobile-nav-item:nth-child(5)) { grid-template-columns: repeat(5, minmax(0,1fr)); }
          .mobile-nav-item { min-width: 0; min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 5px 2px; border-radius: 11px; color: var(--muted); text-decoration: none; font-size: 8px; font-weight: 850; }
          .mobile-nav-item.is-active { color: var(--primary-dark); background: var(--primary-soft); }
          .mobile-nav-icon { width: 23px; height: 23px; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 7px; font-size: 9px; font-weight: 900; }
          .page-wrap { padding-top: 18px; }
          .page-heading { margin-bottom: 17px; gap: 12px; }
          .page-heading h1, .page-title { font-size: 26px; }
          .page-heading .muted, .page-subtitle { font-size: 12px; line-height: 1.55; }
          .context-strip { margin-top: 12px; }
          .btn { min-height: 40px; padding: 0 12px; font-size: 11px; }
          .section-card { padding: 14px; }
          .card-wide { width: 100%; padding: 16px; border-radius: 17px; }
          .grid-3, .grid-2, .dashboard-grid { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr; }
          .staff-layout { grid-template-columns: 1fr; }
        }
        @media (min-width: 601px) and (max-width: 1024px) {
          .app-content { padding-inline: 24px; }
          .mobile-topbar { margin-inline: -24px; padding-inline: 24px; }
          .page-wrap { width: min(100%, 720px); }
          .form-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 430px) {
          .app-content { padding-inline: 10px; }
          .mobile-topbar { margin-inline: -10px; padding-inline: 10px; }
          .page-wrap { padding-top: 14px; }
          .hero-row { display: grid; gap: 11px; }
          .hero-row > .context-strip { margin-top: 0 !important; }
          .page-heading h1, .page-title { font-size: 24px; }
          .lesson-row { grid-template-columns: 44px minmax(0,1fr); }
          .lesson-row .btn { grid-column: 2; justify-self: start; }
          .section-heading { margin-bottom: 12px; }
        }
      `}</style>
    </div>
  );
}
