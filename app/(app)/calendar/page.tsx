import { Suspense } from "react";
import { currentUserId } from "@/lib/auth-server";
import { CalendarClient } from "@/components/calendar/CalendarClient";
import { Spinner } from "@/components/summary/WeekTab";

export default async function CalendarPage() {
  const userId = await currentUserId();
  if (!userId) return null; // middleware guarantees a session; defensive
  return (
    <Suspense fallback={<Spinner />}>
      <CalendarClient userId={userId} />
    </Suspense>
  );
}
