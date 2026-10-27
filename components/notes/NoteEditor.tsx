"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { ArrowLeft, Trash2 } from "lucide-react";
import { deleteNote, updateNote } from "@/lib/local/mutations";
import type { FolderRecord, NoteRecord } from "@/lib/local/types";
import { EditorToolbar } from "./EditorToolbar";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const AUTOSAVE_MS = 500;

/**
 * Tiptap rich-text editor with tables. Content autosaves (debounced 500ms)
 * via the local mutation API — no network on the typing path.
 */
export function NoteEditor({
  note,
  folders,
  onBack,
}: {
  note: NoteRecord;
  folders: FolderRecord[];
  onBack: () => void;
}) {
  const noteIdRef = useRef(note.id);
  noteIdRef.current = note.id;

  // Pending autosave: { content } captured on update, flushed by the timer.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContent = useRef<unknown>(null);

  function flushSave() {
    if (saveTimer.current !== null) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingContent.current !== null) {
      void updateNote(noteIdRef.current, {
        content: pendingContent.current,
      });
      pendingContent.current = null;
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: (note.content as object) ?? EMPTY_DOC,
    immediatelyRender: false, // required under Next SSR
    editorProps: {
      attributes: {
        class: "prose-note outline-none min-h-[50vh] px-1",
      },
    },
    onUpdate: ({ editor }) => {
      pendingContent.current = editor.getJSON();
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushSave, AUTOSAVE_MS);
    },
  });

  // Switching notes: flush the old note's pending save, then swap content
  // without emitting an update.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    flushSave();
    editor.commands.setContent(
      (note.content as object) ?? EMPTY_DOC,
      { emitUpdate: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, editor]);

  // Flush on unmount too (navigating away mid-debounce).
  useEffect(() => flushSave, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          title="Back to list"
          aria-label="Back to list"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-black/5 md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={note.title}
          onChange={(e) => void updateNote(note.id, { title: e.target.value })}
          placeholder="Title"
          className="h-9 min-w-[8rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold outline-none focus:border-[var(--color-check)]"
        />
        <select
          value={note.folderId ?? ""}
          onChange={(e) =>
            void updateNote(note.id, { folderId: e.target.value || null })
          }
          title="Folder"
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--muted)]"
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name || "(folder)"}
            </option>
          ))}
        </select>
        <label
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--muted)]"
          title="Date (shows this note on the calendar)"
        >
          <input
            type="date"
            value={note.date ?? ""}
            onChange={(e) =>
              void updateNote(note.id, { date: e.target.value || null })
            }
            className="bg-transparent text-[var(--muted)] outline-none"
          />
        </label>
        <button
          onClick={() => {
            if (window.confirm("Delete this note?")) void deleteNote(note.id);
            onBack();
          }}
          title="Delete note"
          aria-label="Delete note"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--color-nocheck)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <EditorToolbar editor={editor} />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
