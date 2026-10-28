import { Suspense } from "react";
import { NotesClient } from "@/components/notes/NotesClient";
import { Spinner } from "@/components/summary/WeekTab";

// Static shell: NotesClient resolves the user id client-side (localStorage
// cache + /api/me), so this page prerenders and the navbar link prefetches
// fully — switching sections never waits on a server render.
export default function NotesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NotesClient />
    </Suspense>
  );
}
