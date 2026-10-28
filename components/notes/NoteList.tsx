"use client";

import { format } from "date-fns";
import { FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { createNote } from "@/lib/local/mutations";
import type { NoteRecord } from "@/lib/local/types";

/** Middle column: notes in the selected folder (or Unfiled), newest first. */
export function NoteList({
  userId,
  notes,
  folderId,
  selectedId,
  onSelect,
  className,
}: {
  userId: string;
  notes: NoteRecord[];
  folderId: string | "unfiled";
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  async function addNote() {
    const id = await createNote(userId, folderId === "unfiled" ? null : folderId);
    onSelect(id);
  }

  return (
    <div className={cn("flex w-full flex-col md:w-60", className)}>
      <button
        onClick={() => void addNote()}
        className="mb-2 inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[var(--color-check)] text-sm font-semibold text-white"
      >
        <Plus className="h-4 w-4" />
        New note
      </button>
      <ul className="flex flex-col overflow-y-auto">
        {sorted.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => onSelect(n.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition-colors",
                selectedId === n.id
                  ? "bg-[var(--color-check-soft)]"
                  : "hover:bg-black/5",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                <span className="min-w-0 truncate">
                  {n.title || "(untitled)"}
                </span>
              </span>
              <span className="pl-5 text-xs text-[var(--muted)]">
                {format(n.updatedAt, "d MMM HH:mm")}
                {n.date ? ` · ${n.date}` : ""}
              </span>
            </button>
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="px-2 py-4 text-sm text-[var(--muted)]">
            No notes here yet.
          </li>
        )}
      </ul>
    </div>
  );
}
