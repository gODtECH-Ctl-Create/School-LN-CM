"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function RouteScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".app-content");
    scroller?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
