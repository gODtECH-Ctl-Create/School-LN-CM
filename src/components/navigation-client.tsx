"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

type NavigationItem = readonly [string, string, string, string];

type Props = {
  items: readonly NavigationItem[];
  mobile?: boolean;
};

function Icon({ type, mobile = false }: { type: string; mobile?: boolean }) {
  const common = { width: mobile ? 21 : 18, height: mobile ? 21 : 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (type) {
    case "home": return <svg {...common}><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>;
    case "people": return <svg {...common}><path d="M16 20v-1.8a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 18.2V20"/><circle cx="10" cy="8" r="3"/><path d="M16 5.4a3 3 0 0 1 0 5.8"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.4"/></svg>;
    case "book": return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15"/><path d="M8 7h8"/><path d="M8 10h6"/></svg>;
    case "setup": return <svg {...common}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/></svg>;
    case "lessons": return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg>;
    case "library": return <svg {...common}><path d="M6 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1 0-4h13"/><path d="M6 4v12"/></svg>;
    case "team": return <svg {...common}><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M14 19a5 5 0 0 1 6.5 0"/></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>;
  }
}

function getIconType(key: string) {
  return ({ overview: "home", staff: "people", curriculum: "book", academic: "setup", lessons: "lessons", library: "library", team: "team" } as Record<string, string>)[key] ?? "calendar";
}

export default function NavigationClient({ items, mobile = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    for (const [, , href] of items) {
      if (href !== pathname) void router.prefetch(href);
    }
  }, [items, pathname, router]);

  function navigate(href: string) {
    if (href === pathname) return;
    startTransition(() => router.push(href));
  }

  return (
    <>
      {!mobile && isPending && <div className="route-progress" aria-label="Loading page" />}
      <div className={mobile ? "mobile-nav-items" : "desktop-nav-items"}>
        {items.map(([key, label, href]) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
          return (
            <a
              key={key}
              href={href}
              className={`${mobile ? "mobile-nav-item" : "nav-item"} ${active ? "is-active" : ""} ${isPending ? "is-navigating" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-disabled={isPending ? true : undefined}
              onClick={(event) => {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || isPending) return;
                event.preventDefault();
                navigate(href);
              }}
            >
              <span className={mobile ? "mobile-nav-icon" : "nav-icon"} aria-hidden="true"><Icon type={getIconType(key)} mobile={mobile} /></span>
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </>
  );
}
