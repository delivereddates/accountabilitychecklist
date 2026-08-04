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
  value: CompletionStatus;
  onChange: (status: CompletionStatus) => void;
  size?: "sm" | "md";
}) {
  const sizing = size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm";

  return (
    <div
      role="group"
      aria-label="Task status"
      className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5"
    >
      {OPTIONS.map(({ value: v, label, Icon, active, idle }) => {
        const isActive = value === v;
        return (
          <button
            key={v}
            type="button"
            title={label}
            aria-pressed={isActive}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md font-medium transition-colors",
              sizing,
              isActive ? active : cn("bg-transparent", idle),
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
