"use client";

import { useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createFolder, deleteFolder, renameFolder } from "@/lib/local/mutations";
import type { NoteRecord } from "@/lib/local/types";
import type { FolderTree, FolderTreeNode } from "./folderTree";

/**
 * File-browser folder navigation: clicking a folder opens it. The sidebar
 * shows a breadcrumb trail plus the subfolders at that level, and the note
 * list (driven by the same selection) shows the notes at that level. Counts
 * are direct notes only — what you see when you open the folder. Deleting a
 * folder keeps its notes (they become unfiled) and moves its subfolders up
 * one level.
 */
export function FolderSidebar({
  userId,
  tree,
  notes,
  selected,
  onSelect,
}: {
  userId: string;
  tree: FolderTree;
  notes: NoteRecord[];
  selected: string | "all";
  onSelect: (folderId: string | "all") => void;
}) {
  // null = not adding; "here" = child of the open folder, or a folder id.
  const [addingAt, setAddingAt] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // A stale selection (folder deleted elsewhere / mid-sync) browses the root.
  const open = selected === "all" ? null : (tree.byId.get(selected) ?? null);

  // Breadcrumb path: root → … → open folder. Raw parentId can cycle after
  // an unlucky LWW merge, so the walk carries a visited set.
  const path: FolderTreeNode[] = [];
  if (open) {
    const seen = new Set<string>();
    let node: FolderTreeNode | null = open;
    while (node && !seen.has(node.folder.id)) {
      seen.add(node.folder.id);
      path.unshift(node);
      node = node.folder.parentId
        ? (tree.byId.get(node.folder.parentId) ?? null)
        : null;
    }
  }

  const level = open ? open.children : tree.roots;

  const counts = new Map<string, number>();
  for (const n of notes) {
    if (n.folderId) counts.set(n.folderId, (counts.get(n.folderId) ?? 0) + 1);
  }
  const unfiled = notes.filter((n) => !n.folderId).length;

  function commitAdd(parentId: string | null) {
    const name = newName.trim();
    setNewName("");
    setAddingAt(null);
    if (name) void createFolder(userId, name, parentId);
  }

  function renderRow(node: FolderTreeNode): React.ReactNode {
    const f = node.folder;
    const renaming = renamingId === f.id;

    return (
      <div key={f.id}>
        <div className="group flex items-center gap-0.5">
          {renaming ? (
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
              className="my-0.5 h-8 min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
            />
          ) : (
            <button
              onClick={() => onSelect(f.id)}
              onDoubleClick={() => {
                setRenamingId(f.id);
                setRenameValue(f.name);
              }}
              title={`${f.name || "(folder)"} (double-click to rename)`}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--muted)] transition-colors hover:bg-black/5"
            >
              <Folder className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{f.name || "(folder)"}</span>
              <span className="ml-auto text-xs tabular-nums">
                {counts.get(f.id) ?? 0}
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
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
                setAddingAt(f.id);
                setNewName("");
              }}
              title="New subfolder"
              className="p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Delete folder "${f.name}"? Its notes become unfiled and its subfolders move up one level.`,
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

        {addingAt === f.id && (
          <NewFolderInput
            value={newName}
            onChange={setNewName}
            onCommit={() => commitAdd(f.id)}
            onCancel={() => setAddingAt(null)}
          />
        )}
      </div>
    );
  }

  return (
    <aside className="flex w-full flex-col gap-0.5 md:w-44">
      {path.length > 0 ? (
        <nav
          aria-label="Folder path"
          className="mb-1 flex flex-wrap items-center gap-0.5 text-xs"
        >
          <button
            onClick={() => onSelect("all")}
            title="All notes"
            className="rounded px-1 py-0.5 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]"
          >
            All
          </button>
          {path.map((n) => (
            <span key={n.folder.id} className="flex min-w-0 items-center gap-0.5">
              <ChevronRight className="h-3 w-3 shrink-0 text-[var(--muted)] opacity-60" />
              {n === open ? (
                <span
                  className="min-w-0 truncate font-semibold text-[var(--foreground)]"
                  title={n.folder.name}
                >
                  {n.folder.name || "(folder)"}
                </span>
              ) : (
                <button
                  onClick={() => onSelect(n.folder.id)}
                  title={n.folder.name}
                  className="min-w-0 max-w-24 truncate rounded px-1 py-0.5 text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]"
                >
                  {n.folder.name || "(folder)"}
                </button>
              )}
            </span>
          ))}
        </nav>
      ) : (
        <button
          onClick={() => onSelect("all")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
            !open
              ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
              : "text-[var(--muted)] hover:bg-black/5",
          )}
        >
          All notes
          <span className="ml-auto text-xs tabular-nums">{notes.length}</span>
        </button>
      )}

      {level.map(renderRow)}

      {path.length === 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
          <span className="rounded bg-black/[0.03] px-1.5 py-0.5">
            {unfiled} unfiled
          </span>
        </div>
      )}

      {addingAt === "here" ? (
        <NewFolderInput
          value={newName}
          onChange={setNewName}
          onCommit={() => commitAdd(open?.folder.id ?? null)}
          onCancel={() => setAddingAt(null)}
        />
      ) : (
        <button
          onClick={() => {
            setAddingAt("here");
            setNewName("");
          }}
          title={open ? `New folder inside "${open.folder.name}"` : "New folder"}
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--muted)] hover:bg-black/5"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </button>
      )}
    </aside>
  );
}

function NewFolderInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") onCancel();
      }}
      placeholder="Folder name…"
      autoFocus
      className="mt-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
    />
  );
}
