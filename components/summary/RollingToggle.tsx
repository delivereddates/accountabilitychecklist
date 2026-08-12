"use client";

import { cn } from "@/lib/utils";

/** Single on/off "Rolling" button — on = rolling window, off = calendar. */
export function RollingToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      title={on ? "Rolling window (click for calendar)" : "Calendar (click for rolling window)"}
      className={cn(
        "h-9 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors",
        on
          ? "border-transparent bg-[var(--color-check)] text-white"
          : "border-[var(--border)] text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]",
      )}
    >
      Rolling
    </button>
  );
}
