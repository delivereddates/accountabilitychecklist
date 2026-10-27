import { Suspense } from "react";
import { currentUserId } from "@/lib/auth-server";
import { NotesClient } from "@/components/notes/NotesClient";
import { Spinner } from "@/components/summary/WeekTab";

export default async function NotesPage() {
  const userId = await currentUserId();
  if (!userId) return null; // middleware guarantees a session; defensive
  return (
    <Suspense fallback={<Spinner />}>
      <NotesClient userId={userId} />
    </Suspense>
  );
}
