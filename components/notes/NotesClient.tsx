"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFolders, useNotes, useStorageAvailable } from "@/lib/local/hooks";
import { FolderSidebar } from "./FolderSidebar";
import { buildFolderTree } from "./folderTree";
import { NoteList } from "./NoteList";
import { NoteEditor } from "./NoteEditor";

/**
 * Three-pane notes layout (folders / list / editor) on md+, master-detail
 * swap on phones. Selecting a folder opens it — the list shows the notes at
 * that level (not the subtree). `?id=` deep-links a note (used by the
 * calendar agenda).
 */
export function NotesClient({ userId }: { userId: string }) {
  const notes = useNotes(userId);
  const folders = useFolders(userId);
  const storageOk = useStorageAvailable();
  const searchParams = useSearchParams();

  const [folder, setFolder] = useState<string | "all">("all");
  const paramId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(paramId);

  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders]);
  // A deleted (or mid-sync) selection browses All notes until re-picked.
  const open =
    folder !== "all" && tree.byId.has(folder) ? folder : ("all" as const);
  const visibleNotes = useMemo(() => {
    const all = notes ?? [];
    if (open === "all") return all;
    return all.filter((n) => n.folderId === open);
  }, [notes, open]);

  const selected =
    (notes ?? []).find((n) => n.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Notes</h1>
        <span className="text-sm text-[var(--muted)]">
          {visibleNotes.length} note{visibleNotes.length === 1 ? "" : "s"}
        </span>
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
          <div className="flex flex-col gap-3">
            <FolderSidebar
              userId={userId}
              tree={tree}
              notes={notes}
              selected={open}
              onSelect={setFolder}
            />
          </div>

          <NoteList
            userId={userId}
            notes={visibleNotes}
            folderId={open}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className={cn(selected && "hidden md:flex")}
          />

          <div className={cn("min-w-0", !selected && "hidden md:block")}>
            {selected ? (
              <NoteEditor
                key={selected.id}
                note={selected}
                folderOptions={tree.order}
                onBack={() => setSelectedId(null)}
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
