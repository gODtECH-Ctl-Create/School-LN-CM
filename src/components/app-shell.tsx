import Link from "next/link";
import LogoutButton from "@/src/components/logout-button";
import RouteScrollReset from "@/src/components/route-scroll-reset";
import NavigationClient from "@/src/components/navigation-client";
import ActionLoading from "@/src/components/action-loading";

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
  ["overview", "Home", "/"],
  ["staff", "People", "/admin/staff"],
  ["curriculum", "Curriculum", "/admin/curriculum"],
  ["academic", "Setup", "/admin/academic"],
] as const;

const teacherNavigation = [
  ["overview", "Today", "/"],
  ["lessons", "Lessons", "/teacher/lessons"],
  ["curriculum", "Curriculum", "/teacher/curriculum"],
  ["library", "Library", "/teacher/library"],
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
      ? [...teacherNavigation, ["team", "Team", "/teacher/team"] as const]
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
          <NavigationClient items={navigation} active={active} />
        </nav>

        <div className="sidebar-footer">
          <span className="nav-item is-disabled" aria-disabled="true">
            <span className="nav-icon" aria-hidden="true">?</span>
            Help & support
          </span>
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
            <span className="user-chip-copy">
              <strong>{displayName}</strong>
              <small>{accessLabel}</small>
            </span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="app-content">
        <RouteScrollReset />
        <ActionLoading />
        <header className="mobile-topbar">
          <Link href="/" className="mobile-brand" aria-label="School LN CM home">
            <span className="brand-mark brand-mark-small">SL</span>
            <span className="mobile-brand-copy">
              <strong>{schoolCode}</strong>
              <small>{accessLabel}</small>
            </span>
          </Link>
          <div className="mobile-account-actions">
            <span className="mobile-user-name">{displayName}</span>
            <LogoutButton />
          </div>
        </header>

        {children}

        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          <NavigationClient items={navigation} mobile active={active} />
        </nav>
      </main>
    </div>
  );
}
