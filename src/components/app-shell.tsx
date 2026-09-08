import Link from "next/link";

export type AppRole = "platform_admin" | "school_admin" | "academic_coordinator" | "teacher" | "staff";

type AppShellProps = {
  children: React.ReactNode;
  role: AppRole;
  schoolName: string;
  schoolCode: string;
  userName?: string;
  active?: "overview" | "staff" | "academic" | "curriculum" | "lessons" | "library" | "settings";
};

const adminNavigation = [
  ["overview", "Overview", "/", "O"],
  ["staff", "Staff", "/admin/staff", "S"],
  ["academic", "Academic setup", "/admin/academic", "A"],
  ["curriculum", "Curriculum", "/admin/curriculum", "C"],
] as const;

const teacherNavigation = [
  ["overview", "Today", "/", "T"],
  ["lessons", "My lessons", "/teacher/lessons", "L"],
  ["curriculum", "Curriculum", "#", "C"],
  ["library", "Lesson library", "#", "B"],
] as const;

export function AppShell({ children, role, schoolName, schoolCode, userName, active = "overview" }: AppShellProps) {
  const isAdmin = role === "school_admin" || role === "platform_admin" || role === "academic_coordinator";
  const navigation = isAdmin ? adminNavigation : teacherNavigation;
  const displayName = userName?.trim() || (isAdmin ? "School administrator" : "Teacher");

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
            const disabled = href === "#";
            return disabled ? (
              <span className={`nav-item ${isActive ? "is-active" : "is-disabled"}`} key={key} aria-disabled="true">
                <span className="nav-icon" aria-hidden="true">{mark}</span>
                {label}
                {label === "Curriculum" && <span className="coming-pill">Soon</span>}
              </span>
            ) : (
              <Link className={`nav-item ${isActive ? "is-active" : ""}`} href={href} key={key}>
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
              <small>{isAdmin ? "Administrator" : "Teacher"}</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="app-content">
        <header className="mobile-topbar">
          <Link href="/" className="mobile-brand">
            <span className="brand-mark brand-mark-small">SL</span>
            <strong>School LN CM</strong>
          </Link>
          <span className="mobile-school-code">{schoolCode}</span>
        </header>
        {children}
      </main>
    </div>
  );
}
