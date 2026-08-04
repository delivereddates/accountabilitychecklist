"use client";

import { cn } from "@/lib/utils";
import type { WindowMode } from "@/lib/dates";

export function ModeToggle({
  mode,
  onChange,
  rollingLabel,
  calendarLabel,
}: {
  mode: WindowMode;
  onChange: (mode: WindowMode) => void;
  rollingLabel: string;
  calendarLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label="Time window"
      className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5 text-sm"
    >
      {(
        [
          { value: "rolling", label: rollingLabel },
          { value: "calendar", label: calendarLabel },
        ] as const
      ).map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            mode === o.value
              ? "bg-[var(--color-check)] text-white"
              : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
