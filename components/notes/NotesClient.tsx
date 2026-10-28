"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFolders,
  useNotes,
  useStorageAvailable,
  useSyncStatus,
} from "@/lib/local/hooks";
import { SyncDot } from "@/components/todos/TodosClient";
import { FolderSidebar } from "./FolderSidebar";
import { buildFolderTree, subtreeIds } from "./folderTree";
import { NoteList } from "./NoteList";
import { NoteEditor } from "./NoteEditor";

/**
 * Three-pane notes layout (folder tree / list / editor) on md+,
 * master-detail swap on phones. `?id=` deep-links a note (used by the
 * calendar agenda).
 */
export function NotesClient({ userId }: { userId: string }) {
  const notes = useNotes(userId);
  const folders = useFolders(userId);
  const storageOk = useStorageAvailable();
  const sync = useSyncStatus();
  const searchParams = useSearchParams();

  const [folder, setFolder] = useState<string | "all">("all");
  const paramId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(paramId);

  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders]);
  const visibleNotes = useMemo(() => {
    const all = notes ?? [];
    if (folder === "all") return all;
    // Selecting a folder shows its whole subtree.
    const ids = subtreeIds(tree, folder);
    return all.filter((n) => n.folderId != null && ids.has(n.folderId));
  }, [notes, folder, tree]);

  const selected =
    (notes ?? []).find((n) => n.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Notes</h1>
        <span className="text-sm text-[var(--muted)]">
          {(notes ?? []).length} note{(notes ?? []).length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto">
          <SyncDot pending={sync.pending} error={sync.error} />
        </div>
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
              selected={folder}
              onSelect={setFolder}
            />
          </div>

          <NoteList
            userId={userId}
            notes={visibleNotes}
            folderId={folder}
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
