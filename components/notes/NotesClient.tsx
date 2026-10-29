"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFolders,
  useLocalUserId,
  useNotes,
  useStorageAvailable,
} from "@/lib/local/hooks";
import { FolderSidebar } from "./FolderSidebar";
import { buildFolderTree } from "./folderTree";

// The Tiptap editor is by far the heaviest chunk in the app (~276 KB); lazy
// it so tapping the Notes tab loads just the list, and the editor bundle
// downloads on first note open instead.
const NoteEditor = dynamic(() => import("./NoteEditor").then((m) => m.NoteEditor));

/**
 * The notes home is one page: the folder tree. Folders expand to show their
 * notes inline, unfiled notes sit at the base level, and the tree's "New
 * note" button files into the selected folder — there is no separate flat
 * list view. md+ shows tree + editor side by side; phones swap between tree
 * and the open note's editor. `?id=` deep-links a note (used by the calendar
 * agenda).
 */
export function NotesClient() {
  const userId = useLocalUserId();
  const notes = useNotes(userId);
  const folders = useFolders(userId);
  const storageOk = useStorageAvailable();
  const searchParams = useSearchParams();

  // Where "New note" files; the tree highlights it.
  const [folder, setFolder] = useState<string | "unfiled">("unfiled");
  const paramId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(paramId);

  const tree = useMemo(() => buildFolderTree(folders ?? []), [folders]);
  // A deleted (or mid-sync) selection browses Unfiled until re-picked.
  const open =
    folder !== "unfiled" && tree.byId.has(folder) ? folder : ("unfiled" as const);

  const selected = (notes ?? []).find((n) => n.id === selectedId) ?? null;

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
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Notes</h1>

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
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[16rem_1fr] md:items-start">
          <div className={cn("flex flex-col gap-3", selected && "hidden md:flex")}>
            <FolderSidebar
              userId={userId}
              tree={tree}
              notes={notes}
              selected={open}
              onSelect={setFolder}
              selectedNoteId={selectedId}
              onOpenNote={setSelectedId}
            />
          </div>

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
