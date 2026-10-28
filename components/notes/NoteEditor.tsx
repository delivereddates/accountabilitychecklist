"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deleteNote,
  duplicateNote,
  updateNote,
  type NotePatch,
} from "@/lib/local/mutations";
import type { NoteRecord } from "@/lib/local/types";
import { EditorToolbar } from "./EditorToolbar";
import { pasteGrid } from "./pasteGrid";
import { TableDrag } from "./tableDrag";
import type { FolderTreeNode } from "./folderTree";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const AUTOSAVE_MS = 500;

// Editor font-size preference, per device. The -v2 suffix retires the old
// key: values saved before phones defaulted to "sm" kept overriding the new
// default, so the text stayed big no matter what. One clean reset.
const FONT_KEY = "note-font-size-v2";
type FontSize = "sm" | "base" | "lg";
const FONT_SIZES: { key: FontSize; label: string; px: string }[] = [
  { key: "sm", label: "Small text", px: "0.875rem" },
  { key: "base", label: "Medium text", px: "1rem" },
  { key: "lg", label: "Large text", px: "1.125rem" },
];

/**
 * Tiptap rich-text editor with tables. Title and content autosave (debounced
 * 500ms, one write) via the local mutation API — the title edits fully
 * locally so the cursor never jumps, and nothing touches the network on the
 * typing path. The font-size control is a per-device preference.
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

  // The title edits locally (instant cursor) and autosaves with the content.
  // Keyed per note id, so it re-initializes on note switches.
  const [title, setTitle] = useState(note.title);

  const [font, setFont] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "base";
    const v = window.localStorage.getItem(FONT_KEY);
    if (v === "sm" || v === "base" || v === "lg") return v;
    // First visit on this device: phones start one step smaller — the base
    // size matches the rest of the app's text-sm UI and reads far better on
    // a narrow screen. A saved preference always wins.
    return window.matchMedia("(max-width: 767px)").matches ? "sm" : "base";
  });

  function chooseFont(next: FontSize) {
    setFont(next);
    try {
      window.localStorage.setItem(FONT_KEY, next);
    } catch {
      // Private mode etc. — the toggle still works for this visit.
    }
  }

  // Pending autosave patch ({ title } / { content }) captured on edit,
  // flushed by the timer — one IndexedDB write per debounce window.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<NotePatch>({});

  function queuePatch(patch: NotePatch) {
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushSave(), AUTOSAVE_MS);
  }

  async function flushSave(): Promise<void> {
    if (saveTimer.current !== null) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const patch = pendingPatch.current;
    if (patch.title === undefined && patch.content === undefined) return;
    pendingPatch.current = {};
    await updateNote(noteIdRef.current, patch);
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
      queuePatch({ content: editor.getJSON() });
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
          title="Back to notes"
          aria-label="Back to notes"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-black/5 md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queuePatch({ title: e.target.value });
          }}
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

      <div className="flex flex-wrap items-center gap-2">
        <EditorToolbar editor={editor} />
        <div
          role="group"
          aria-label="Font size"
          title="Font size"
          className="flex rounded-lg border border-[var(--border)] bg-[var(--card)] p-0.5"
        >
          {FONT_SIZES.map((f, i) => (
            <button
              key={f.key}
              onClick={() => chooseFont(f.key)}
              title={f.label}
              aria-label={f.label}
              className={cn(
                "rounded-md px-2 py-1 font-semibold transition-colors",
                i === 0 && "text-xs",
                i === 1 && "text-sm",
                i === 2 && "text-base",
                font === f.key
                  ? "bg-[var(--color-check-soft)] text-[var(--color-check)]"
                  : "text-[var(--muted)] hover:bg-black/5",
              )}
            >
              A
            </button>
          ))}
        </div>
      </div>

      <div
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
        style={{ fontSize: FONT_SIZES.find((f) => f.key === font)?.px }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
