import { Suspense } from "react";
import { WeekTab, Spinner } from "@/components/summary/WeekTab";

export default function WeekPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <WeekTab />
    </Suspense>
  );
}
