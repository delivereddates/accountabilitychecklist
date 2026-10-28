"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncStatus } from "@/lib/local/hooks";

/**
 * Cloud-backup state for the whole app, shown in the navbar. Local-first
 * means every change is saved on-device instantly — this answers "is it
 * safely on the server yet?". Replaces the per-page sync dots.
 */
export function SyncStatus() {
  const { pending, pushing, pulling, error } = useSyncStatus();

  let icon: React.ReactNode;
  let label: string;
  let title: string;
  let tone: string;

  if (error) {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = "Not synced";
    title = `Sync problem: ${error}. Changes are safe on this device and will retry automatically.`;
    tone = "text-[var(--color-nocheck)]";
  } else if (pending > 0 || pushing) {
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    label = "Saving…";
    title =
      pending > 0
        ? `Saving ${pending} change${pending === 1 ? "" : "s"} to the server…`
        : "Saving changes to the server…";
    tone = "text-[var(--muted)]";
  } else if (pulling) {
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    label = "Syncing…";
    title = "Checking this account's other devices for changes…";
    tone = "text-[var(--muted)]";
  } else {
    icon = <Check className="h-3.5 w-3.5" />;
    label = "Synced";
    title = "All changes saved to the server.";
    tone = "text-[var(--color-check)]";
  }

  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] px-2 text-xs font-medium",
        tone,
      )}
    >
      {icon}
      {/* Icon-only on phones; the label needs the wider bar. */}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
