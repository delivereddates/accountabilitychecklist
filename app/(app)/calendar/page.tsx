import { Suspense } from "react";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { Spinner } from "@/components/summary/WeekTab";

// Static shell: CalendarClient resolves the user id client-side (localStorage
// cache + /api/me), so this page prerenders and the navbar link prefetches
// fully — switching sections never waits on a server render.
export default function CalendarPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CalendarClient />
    </Suspense>
  );
}
