import { Check, Minus, Plane, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompletionStatus } from "@/lib/types";

/** Compact glyph for a status, used across summary tables. */
export function StatusGlyph({
  status,
  className,
}: {
  status: CompletionStatus | undefined;
  className?: string;
}) {
  if (status === "check")
    return (
      <Check
        className={cn("text-[var(--color-check)]", className)}
        aria-label="Check"
      />
    );
  if (status === "exempt")
    return (
      <Plane
        className={cn("text-[var(--color-exempt)]", className)}
        aria-label="Exempt"
      />
    );
  if (status === "no_check")
    return (
      <X
        className={cn("text-[var(--color-nocheck)]", className)}
        aria-label="Missed"
      />
    );
  return (
    <Minus
      className={cn("text-[var(--muted)] opacity-40", className)}
      aria-label="No data"
    />
  );
}

export function StatusLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]",
        className,
      )}
    >
      <LegendItem icon={<Check className="h-3.5 w-3.5 text-[var(--color-check)]" />} label="Check" />
      <LegendItem icon={<X className="h-3.5 w-3.5 text-[var(--color-nocheck)]" />} label="Missed" />
      <LegendItem icon={<Plane className="h-3.5 w-3.5 text-[var(--color-exempt)]" />} label="Exempt" />
      <LegendItem icon={<Minus className="h-3.5 w-3.5 text-[var(--muted)] opacity-40" />} label="No data" />
    </div>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  );
}
