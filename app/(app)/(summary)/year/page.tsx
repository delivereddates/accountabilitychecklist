import { Suspense } from "react";
import { YearTab } from "@/components/summary/YearTab";
import { Spinner } from "@/components/summary/WeekTab";

export default function YearPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <YearTab />
    </Suspense>
  );
}
