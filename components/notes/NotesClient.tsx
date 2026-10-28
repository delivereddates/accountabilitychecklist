"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOff, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFolders,
  useLocalUserId,
  useNotes,
  useStorageAvailable,
} from "@/lib/local/hooks";
import { FolderSidebar } from "./FolderSidebar";
import { buildFolderTree } from "./folderTree";
import { NoteList } from "./NoteList";
import { NoteEditor } from "./NoteEditor";

/**
 * Three-pane notes layout (folders / list / editor) on md+. The folder tree
 * is the single entry point — there is no flat "all notes" page; the tree
 * leads with an "Unfiled" row for notes without a folder. On phones it's a
 * master-detail swap: the folder page shows first, picking a folder (or
 * Unfiled) swaps to that note list, opening a note swaps to the editor.
 * `?id=` deep-links a note (used by the calendar agenda).
 */
export function NotesClient() {
  const userId = useLocalUserId();
  const notes = useNotes(userId);
  const folders = useFolders(userId);
  const storageOk = useStorageAvailable();
  const searchParams = useSearchParams();

  const [folder, setFolder] = useState<string | "unfiled">("unfiled");
  const paramId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(paramId);
  // Phones only: the folder page is the home view (desktop always shows the
  // rail), and the header toggle brings it back after drilling in.
  const [showFolders, setShowFolders] = useState(true);

  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders]);
  // A deleted (or mid-sync) selection browses Unfiled until re-picked.
  const open =
    folder !== "unfiled" && tree.byId.has(folder) ? folder : ("unfiled" as const);
  const visibleNotes = useMemo(() => {
    const all = notes ?? [];
    if (open === "unfiled") return all.filter((n) => !n.folderId);
    return all.filter((n) => n.folderId === open);
  }, [notes, open]);

  const selected =
    (notes ?? []).find((n) => n.id === selectedId) ?? null;

  if (!userId) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Notes</h1>
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Notes</h1>
        <span className="text-sm text-[var(--muted)]">
          {visibleNotes.length} note{visibleNotes.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => setShowFolders((v) => !v)}
          title={showFolders ? "Hide folders" : "Show folders"}
          aria-label={showFolders ? "Hide folders" : "Show folders"}
          className={cn(
            "ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] transition-colors hover:bg-black/5 md:hidden",
            showFolders
              ? "bg-[var(--color-check-soft)] text-[var(--color-check)]"
              : "text-[var(--muted)]",
          )}
        >
          <FolderTree className="h-4 w-4" />
        </button>
      </header>

      {!storageOk && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--muted)]">
          <CloudOff className="h-4 w-4 shrink-0" />
          Offline storage is unavailable in this browser (private mode?) —
          changes can&apos;t be saved.
        </p>
      )}

      {notes === undefined || folders === undefined ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[11rem_15rem_1fr] md:items-start">
          <div
            className={cn(
              "flex flex-col gap-3",
              (!showFolders || selected) && "hidden md:flex",
            )}
          >
            <FolderSidebar
              userId={userId}
              tree={tree}
              notes={notes}
              selected={open}
              onSelect={(id) => {
                setFolder(id);
                setShowFolders(false);
              }}
              selectedNoteId={selectedId}
              onOpenNote={setSelectedId}
            />
          </div>

          <NoteList
            userId={userId}
            notes={visibleNotes}
            folderId={open}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className={cn((selected || showFolders) && "hidden md:flex")}
          />

          <div className={cn("min-w-0", !selected && "hidden md:block")}>
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                folderOptions={tree.order}
                onBack={() => setSelectedId(null)}
                onOpenNote={setSelectedId}
              />
            ) : (
              <p className="pt-16 text-center text-sm text-[var(--muted)]">
                Pick a note, or create one.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
