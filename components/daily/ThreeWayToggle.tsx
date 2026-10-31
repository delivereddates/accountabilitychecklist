"use client";

import { Check, Plane, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompletionStatus } from "@/lib/types";

interface Option {
  value: CompletionStatus;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: string;
  idle: string;
}

const OPTIONS: Option[] = [
  {
    value: "check",
    label: "Check",
    Icon: Check,
    active: "bg-[var(--color-check)] text-white",
    idle: "text-[var(--color-check)] hover:bg-[var(--color-check-soft)]",
  },
  {
    value: "no_check",
    label: "Missed",
    Icon: X,
    active: "bg-[var(--color-nocheck)] text-white",
    idle: "text-[var(--color-nocheck)] hover:bg-[var(--color-nocheck-soft)]",
  },
  {
    value: "exempt",
    label: "Exempt",
    Icon: Plane,
    active: "bg-[var(--color-exempt)] text-white",
    idle: "text-[var(--color-exempt)] hover:bg-[var(--color-exempt-soft)]",
  },
];

export function ThreeWayToggle({
  value,
  onChange,
  size = "md",
}: {
  value: CompletionStatus | null;
  onChange: (status: CompletionStatus | null) => void;
  size?: "sm" | "md";
}) {
  // grid-cols-3 keeps Check / Missed / Exempt the same width regardless of
  // label length, so Exempt no longer looks wider than the others.
  // Phones get full 44px targets: labels are hidden below md, so the buttons
  // would otherwise be ~22px wide — far under any touch-target minimum, which
  // is what made rapid taps land on the neighbor or in the gaps ("nothing
  // happens / the wrong button triggers"). md+ keeps the compact labelled
  // sizing. select-none stops rapid tapping from kicking off text selection.
  const sizing = size === "sm" ? "text-xs md:h-7" : "text-sm md:h-8";

  return (
    <div
      role="group"
      aria-label="Task status"
      className="inline-grid select-none grid-cols-3 items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5"
    >
      {OPTIONS.map(({ value: v, label, Icon, active, idle }) => {
        const isActive = value === v;
        return (
          <button
            key={v}
            type="button"
            title={label}
            aria-pressed={isActive}
            // Clicking the already-active status clears it back to "no data".
            onClick={() => onChange(isActive ? null : v)}
            className={cn(
              "col-span-1 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md px-1 font-medium transition-colors md:min-w-0",
              sizing,
              isActive ? active : cn("bg-transparent", idle),
            )}
          >
            <Icon className="h-4 w-4 shrink-0 md:h-3.5 md:w-3.5" />
            <span className="hidden md:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
