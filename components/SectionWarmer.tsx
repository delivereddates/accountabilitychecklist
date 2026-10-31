"use client";

import { useEffect } from "react";

/**
 * Warms the other sections' client bundles once the browser is idle after
 * load. The section pages are static shells and the navbar links prefetch
 * their RSC payloads automatically, but the client components' JS chunks
 * still download on first navigation — that chunk fetch + parse is the small
 * lag when tapping between sections right after the app opens. Importing the
 * modules here loads the same chunks the router will use, so the navigation
 * renders from memory. Renders nothing.
 */
export function SectionWarmer() {
  useEffect(() => {
    const warm = () => {
      void import("@/components/todos/TodosClient");
      void import("@/components/calendar/CalendarClient");
      void import("@/components/notes/NotesClient");
      void import("@/components/daily/DailyClient");
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 2000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
