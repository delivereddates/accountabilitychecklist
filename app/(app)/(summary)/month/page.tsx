import { Suspense } from "react";
import { MonthTab } from "@/components/summary/MonthTab";
import { Spinner } from "@/components/summary/WeekTab";

export default function MonthPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MonthTab />
    </Suspense>
  );
}
