"use client";

import { useState } from "react";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Inbox,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createFolder,
  createNote,
  deleteFolder,
  renameFolder,
} from "@/lib/local/mutations";
import type { NoteRecord } from "@/lib/local/types";
import type { FolderTree, FolderTreeNode } from "./folderTree";

/**
 * The notes home page — one tree, no separate list view. Unfiled notes sit
 * at the base level under an expandable "Unfiled" row; expanding a folder
 * reveals its contents inline (subfolders first, then the notes directly
 * inside it). Clicking a folder's name selects it — that's where the "New
 * note" button files the note — and opens it if it was collapsed. Row counts
 * roll up the whole subtree. Deleting a folder keeps its notes (they become
 * unfiled) and moves its subfolders up one level.
 */
export function FolderSidebar({
  userId,
  tree,
  notes,
  selected,
  onSelect,
  selectedNoteId,
  onOpenNote,
}: {
  userId: string;
  tree: FolderTree;
  notes: NoteRecord[];
  selected: string | "unfiled";
  onSelect: (folderId: string | "unfiled") => void;
  selectedNoteId: string | null;
  onOpenNote: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // null = not adding; "root" or a folder id = where the new folder goes.
  const [addingAt, setAddingAt] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Direct notes per folder (what expansion reveals).
  const byFolder = new Map<string, NoteRecord[]>();
  for (const n of notes) {
    if (n.folderId) {
      const list = byFolder.get(n.folderId);
      if (list) list.push(n);
      else byFolder.set(n.folderId, [n]);
    }
  }
  const totals = new Map<string, number>();
  const rollUp = (node: FolderTreeNode): number => {
    let count = (byFolder.get(node.folder.id) ?? []).length;
    for (const child of node.children) count += rollUp(child);
    totals.set(node.folder.id, count);
    return count;
  };
  tree.roots.forEach(rollUp);
  const unfiledNotes = notes
    .filter((n) => !n.folderId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const unfiledOpen = !collapsed.has("unfiled");

  // New note goes into the selected folder (or Unfiled), which expands so
  // the note is visible in the tree when the editor closes.
  async function addNote() {
    const target = selected === "unfiled" ? null : selected;
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(selected);
      return next;
    });
    const id = await createNote(userId, target);
    if (id) onOpenNote(id);
  }

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

  function renderNote(note: NoteRecord, depth: number): React.ReactNode {
    return (
      <button
        key={note.id}
        onClick={() => onOpenNote(note.id)}
        title={note.title || "(untitled)"}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1 pl-2 pr-2 text-left text-[13px] transition-colors",
          selectedNoteId === note.id
            ? "bg-[var(--color-check-soft)] font-medium text-[var(--color-check)]"
            : "text-[var(--muted)] hover:bg-black/5",
        )}
        style={{ paddingLeft: depth * 14 + 18 }}
      >
        <FileText className="h-3 w-3 shrink-0 opacity-70" />
        <span className="min-w-0 truncate">{note.title || "(untitled)"}</span>
      </button>
    );
  }

  function renderNode(node: FolderTreeNode): React.ReactNode {
    const f = node.folder;
    const directNotes = byFolder.get(f.id) ?? [];
    const expandable = node.children.length > 0 || directNotes.length > 0;
    const isCollapsed = collapsed.has(f.id);
    const renaming = renamingId === f.id;
    const depth = node.depth;

    return (
      <div key={f.id}>
        <div
          className="group flex items-center gap-0.5"
          style={{ paddingLeft: depth * 14 }}
        >
          <button
            onClick={() => expandable && toggle(f.id)}
            title={
              expandable ? (isCollapsed ? "Expand" : "Collapse") : undefined
            }
            className={cn(
              "flex h-5 w-4 shrink-0 items-center justify-center text-[var(--muted)]",
              !expandable && "invisible",
            )}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                expandable && !isCollapsed && "rotate-90",
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
              onClick={() => {
                onSelect(f.id);
                if (isCollapsed) toggle(f.id);
              }}
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
            indent={depth * 14 + 18}
          />
        )}

        {expandable && !isCollapsed && (
          <div>
            {node.children.map(renderNode)}
            {directNotes
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((n) => renderNote(n, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex w-full flex-col gap-0.5 md:w-64">
      <button
        onClick={() => void addNote()}
        className="mb-2 inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-[var(--color-check)] text-sm font-semibold text-white"
      >
        <Plus className="h-4 w-4" />
        New note
      </button>

      <div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => unfiledNotes.length > 0 && toggle("unfiled")}
            title={unfiledOpen ? "Collapse" : "Expand"}
            className={cn(
              "flex h-5 w-4 shrink-0 items-center justify-center text-[var(--muted)]",
              unfiledNotes.length === 0 && "invisible",
            )}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                unfiledNotes.length > 0 && unfiledOpen && "rotate-90",
              )}
            />
          </button>
          <button
            onClick={() => {
              onSelect("unfiled");
              if (!unfiledOpen && unfiledNotes.length > 0) toggle("unfiled");
            }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
              selected === "unfiled"
                ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
                : "text-[var(--muted)] hover:bg-black/5",
            )}
          >
            <Inbox className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">Unfiled</span>
            <span className="ml-auto text-xs tabular-nums">
              {unfiledNotes.length}
            </span>
          </button>
        </div>
        {unfiledOpen && unfiledNotes.map((n) => renderNote(n, 0))}
      </div>

      {tree.roots.map(renderNode)}

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
