import { Suspense } from "react";
import { DailyClient } from "@/components/daily/DailyClient";

export default function DailyPage() {
  return (
    <Suspense fallback={null}>
      <DailyClient />
    </Suspense>
  );
}
