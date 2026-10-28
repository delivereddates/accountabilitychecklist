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
 * Folder tree with inline add / rename (blur-commit) and delete-with-confirm.
 * Deleting a folder keeps its notes (they become unfiled) and moves its
 * subfolders up one level. Counts include everything in the subtree.
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // null = not adding; "root" or a folder id = where the new folder goes.
  const [addingAt, setAddingAt] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Direct note count per folder id, rolled up over the tree.
  const direct = new Map<string, number>();
  for (const n of notes) {
    if (n.folderId) direct.set(n.folderId, (direct.get(n.folderId) ?? 0) + 1);
  }
  const totals = new Map<string, number>();
  const rollUp = (node: FolderTreeNode): number => {
    let count = direct.get(node.folder.id) ?? 0;
    for (const child of node.children) count += rollUp(child);
    totals.set(node.folder.id, count);
    return count;
  };
  tree.roots.forEach(rollUp);
  const unfiled = notes.filter((n) => !n.folderId).length;

  function commitAdd(parentId: string | null) {
    const name = newName.trim();
    setNewName("");
    setAddingAt(null);
    if (name) void createFolder(userId, name, parentId);
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: FolderTreeNode): React.ReactNode {
    const f = node.folder;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(f.id);
    const renaming = renamingId === f.id;

    return (
      <div key={f.id}>
        <div
          className="group flex items-center gap-0.5"
          style={{ paddingLeft: node.depth * 14 }}
        >
          <button
            onClick={() => hasChildren && toggle(f.id)}
            title={hasChildren ? (isCollapsed ? "Expand" : "Collapse") : undefined}
            className={cn(
              "flex h-5 w-4 shrink-0 items-center justify-center text-[var(--muted)]",
              !hasChildren && "invisible",
            )}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                hasChildren && !isCollapsed && "rotate-90",
              )}
            />
          </button>

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
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                selected === f.id
                  ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
                  : "text-[var(--muted)] hover:bg-black/5",
              )}
            >
              <Folder className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{f.name || "(folder)"}</span>
              <span className="ml-auto text-xs tabular-nums">
                {totals.get(f.id) ?? 0}
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
            indent={node.depth * 14 + 18}
          />
        )}

        {hasChildren && !isCollapsed && (
          <div>{node.children.map(renderNode)}</div>
        )}
      </div>
    );
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

      {tree.roots.map(renderNode)}

      <div className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
        <span className="rounded bg-black/[0.03] px-1.5 py-0.5">
          {unfiled} unfiled
        </span>
      </div>

      {addingAt === "root" ? (
        <NewFolderInput
          value={newName}
          onChange={setNewName}
          onCommit={() => commitAdd(null)}
          onCancel={() => setAddingAt(null)}
          indent={0}
        />
      ) : (
        <button
          onClick={() => {
            setAddingAt("root");
            setNewName("");
          }}
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
  indent,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  indent: number;
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
      style={{ marginLeft: indent }}
      className="mt-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
    />
  );
}
