"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDDMMYY } from "@/lib/utils";

/**
 * Compact date control: ‹ DD-MM-YY ›. The formatted text is a <label> wrapping
 * a visually-hidden native date input, so clicking it opens the browser picker
 * while the visible format stays DD-MM-YY.
 */
export function DateStepper({
  value,
  onChange,
  onPrev,
  onNext,
}: {
  value: string;
  onChange: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPrev}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
        aria-label="Previous"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <label
        className="flex h-9 cursor-pointer items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 text-sm tabular-nums"
        title="Pick a date"
      >
        <span>{formatDDMMYY(value)}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="sr-only"
        />
      </label>
      <button
        onClick={onNext}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
        aria-label="Next"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
