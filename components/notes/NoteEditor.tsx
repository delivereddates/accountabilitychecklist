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
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { deleteNote, duplicateNote, updateNote } from "@/lib/local/mutations";
import type { NoteRecord } from "@/lib/local/types";
import { EditorToolbar } from "./EditorToolbar";
import { pasteGrid } from "./pasteGrid";
import { TableDrag } from "./tableDrag";
import type { FolderTreeNode } from "./folderTree";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const AUTOSAVE_MS = 500;

/**
 * Tiptap rich-text editor with tables. Content autosaves (debounced 500ms)
 * via the local mutation API — no network on the typing path.
 */
export function NoteEditor({
  note,
  folderOptions,
  onBack,
  onOpenNote,
}: {
  note: NoteRecord;
  folderOptions: FolderTreeNode[];
  onBack: () => void;
  onOpenNote: (id: string) => void;
}) {
  const noteIdRef = useRef(note.id);
  noteIdRef.current = note.id;

  // Pending autosave: { content } captured on update, flushed by the timer.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContent = useRef<unknown>(null);

  async function flushSave(): Promise<void> {
    if (saveTimer.current !== null) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingContent.current !== null) {
      const content = pendingContent.current;
      pendingContent.current = null;
      await updateNote(noteIdRef.current, { content });
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TableDrag,
    ],
    content: (note.content as object) ?? EMPTY_DOC,
    immediatelyRender: false, // required under Next SSR
    editorProps: {
      attributes: {
        class: "prose-note outline-none min-h-[50vh] px-1",
      },
      // CSV / TSV text pastes become table rows (components/notes/pasteGrid).
      // Clipboard HTML that already contains a table is left to PM's parser.
      handlePaste: (view, event) => {
        const dt = event.clipboardData;
        if (!dt) return false;
        if (/<table[\s>]/i.test(dt.getData("text/html"))) return false;
        const text = dt.getData("text/plain");
        if (!text) return false;
        return pasteGrid(view, text);
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
    void flushSave();
    editor.commands.setContent(
      (note.content as object) ?? EMPTY_DOC,
      { emitUpdate: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, editor]);

  // Flush on unmount too (navigating away mid-debounce).
  useEffect(() => () => void flushSave(), []);

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
          {folderOptions.map(({ folder, depth }) => (
            <option key={folder.id} value={folder.id}>
              {"  ".repeat(depth)}
              {depth > 0 ? "· " : ""}
              {folder.name || "(folder)"}
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
          onClick={async () => {
            // Flush the debounce first so the copy includes the latest edits.
            await flushSave();
            const id = await duplicateNote(note.id);
            if (id) onOpenNote(id);
          }}
          title="Duplicate note"
          aria-label="Duplicate note"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-black/5"
        >
          <Copy className="h-4 w-4" />
        </button>
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
