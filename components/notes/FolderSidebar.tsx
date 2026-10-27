"use client";

import { useState } from "react";
import { Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createFolder, deleteFolder, renameFolder } from "@/lib/local/mutations";
import type { FolderRecord, NoteRecord } from "@/lib/local/types";

/**
 * Folder list with inline add / rename (blur-commit) and delete-with-confirm.
 * Deleting a folder keeps its notes — they move to "unfiled".
 */
export function FolderSidebar({
  userId,
  folders,
  notes,
  selected,
  onSelect,
}: {
  userId: string;
  folders: FolderRecord[];
  notes: NoteRecord[];
  selected: string | "all";
  onSelect: (folderId: string | "all") => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const counts = new Map<string, number>();
  for (const n of notes) {
    if (n.folderId) counts.set(n.folderId, (counts.get(n.folderId) ?? 0) + 1);
  }
  const unfiled = notes.filter((n) => !n.folderId).length;

  function commitAdd() {
    const name = newName.trim();
    setNewName("");
    setAdding(false);
    if (name) void createFolder(userId, name);
  }

  return (
    <aside className="flex w-full flex-col gap-0.5 md:w-44">
      <button
        onClick={() => onSelect("all")}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
          selected === "all"
            ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
            : "text-[var(--muted)] hover:bg-black/5",
        )}
      >
        All notes
        <span className="ml-auto text-xs tabular-nums">{notes.length}</span>
      </button>

      {folders.map((f) => (
        <div key={f.id} className="group flex items-center gap-1">
          {renamingId === f.id ? (
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                const v = renameValue.trim();
                if (v && v !== f.name) void renameFolder(f.id, v);
                setRenamingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenamingId(null);
              }}
              autoFocus
              className="h-8 min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
            />
          ) : (
            <button
              onClick={() => onSelect(f.id)}
              onDoubleClick={() => {
                setRenamingId(f.id);
                setRenameValue(f.name);
              }}
              title={`${f.name} (double-click to rename)`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                selected === f.id
                  ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
                  : "text-[var(--muted)] hover:bg-black/5",
              )}
            >
              <Folder className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{f.name || "(folder)"}</span>
              <span className="ml-auto text-xs tabular-nums">
                {counts.get(f.id) ?? 0}
              </span>
            </button>
          )}
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => {
                setRenamingId(f.id);
                setRenameValue(f.name);
              }}
              title="Rename folder"
              className="p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Delete folder "${f.name}"? Its notes are kept and become unfiled.`,
                  )
                )
                  void deleteFolder(f.id);
              }}
              title="Delete folder"
              className="p-1 text-[var(--muted)] hover:text-[var(--color-nocheck)]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        </div>
      ))}

      <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
        <span className="rounded bg-black/[0.03] px-1.5 py-0.5">
          {unfiled} unfiled
        </span>
      </div>

      {adding ? (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitAdd}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setAdding(false);
              setNewName("");
            }
          }}
          placeholder="Folder name…"
          autoFocus
          className="mt-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--muted)] hover:bg-black/5"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </button>
      )}
    </aside>
  );
}
