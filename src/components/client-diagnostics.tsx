"use client";

import { useEffect } from "react";

function report(payload: Record<string, unknown>) {
  try {
    void fetch("/api/client-diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, path: window.location.pathname }),
      keepalive: true,
    });
  } catch {
    // Diagnostics must never affect the application.
  }
}

export default function ClientDiagnostics() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      report({ type: "window.error", message: event.message, stack: event.error?.stack ?? "" });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report({
        type: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack ?? "" : "",
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const interactive = target.closest("button, input, label, a, select");
      if (!interactive) return;
      const beforePath = window.location.pathname + window.location.search;
      const academic = Boolean(document.querySelector(".academic-v3, .structure-setup"));
      if (!academic) return;

      window.setTimeout(() => {
        const afterPath = window.location.pathname + window.location.search;
        const academicStillPresent = Boolean(document.querySelector(".academic-v3, .structure-setup"));
        const bodyTextLength = document.body?.innerText?.trim().length ?? 0;
        if (afterPath !== beforePath || !academicStillPresent || bodyTextLength < 80) {
          report({
            type: "academic-click-result",
            message: "Academic content changed unexpectedly after an interactive click.",
            target: interactive.tagName.toLowerCase() + (interactive.className ? `.${String(interactive.className).replace(/\s+/g, ".")}` : ""),
            details: { beforePath, afterPath, academicStillPresent, bodyTextLength },
          });
        }
      }, 250);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
