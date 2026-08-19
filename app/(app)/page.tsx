import { Suspense } from "react";
import { DailyClient } from "@/components/daily/DailyClient";
import { currentUserId } from "@/lib/auth-server";

export default async function DailyPage() {
  const userId = await currentUserId();
  return (
    <Suspense fallback={null}>
      <DailyClient currentUserId={userId ?? ""} />
    </Suspense>
  );
}
