import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="ml-2 text-sm">Loading…</span>
    </div>
  );
}
