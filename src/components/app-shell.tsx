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
    </div>
  );
}
