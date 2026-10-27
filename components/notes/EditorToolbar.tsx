"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toolbar for the note editor: basic formatting plus table operations in a
 * native <details> disclosure (no menu library). All commands are chained
 * with .focus() so typing resumes immediately.
 */
export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const btn = (
    active: boolean,
    label: string,
    title: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-[var(--color-check-soft)] text-[var(--color-check)]"
          : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]",
        disabled && "opacity-30",
      )}
    >
      {icon}
    </button>
  );

  const chain = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1">
      {btn(editor.isActive("bold"), "b", "Bold", <Bold className="h-4 w-4" />, () =>
        chain().toggleBold().run(),
      )}
      {btn(editor.isActive("italic"), "i", "Italic", <Italic className="h-4 w-4" />, () =>
        chain().toggleItalic().run(),
      )}
      {btn(editor.isActive("heading", { level: 2 }), "h2", "Heading 2", <Heading2 className="h-4 w-4" />, () =>
        chain().toggleHeading({ level: 2 }).run(),
      )}
      {btn(editor.isActive("heading", { level: 3 }), "h3", "Heading 3", <Heading3 className="h-4 w-4" />, () =>
        chain().toggleHeading({ level: 3 }).run(),
      )}
      {btn(editor.isActive("bulletList"), "ul", "Bullet list", <List className="h-4 w-4" />, () =>
        chain().toggleBulletList().run(),
      )}
      {btn(editor.isActive("orderedList"), "ol", "Numbered list", <ListOrdered className="h-4 w-4" />, () =>
        chain().toggleOrderedList().run(),
      )}
      {btn(editor.isActive("blockquote"), "q", "Quote", <Quote className="h-4 w-4" />, () =>
        chain().toggleBlockquote().run(),
      )}

      <span className="mx-1 h-5 w-px bg-[var(--border)]" />

      <details className="relative">
        <summary
          className={cn(
            "flex h-8 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]",
            editor.isActive("table") && "bg-[var(--color-check-soft)] text-[var(--color-check)]",
          )}
        >
          <TableIcon className="h-4 w-4" />
          Table
        </summary>
        <div className="absolute left-0 top-9 z-20 flex w-48 flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 text-sm shadow-lg">
          <MenuBtn
            label="Insert 3×3 table"
            disabled={editor.isActive("table")}
            onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          />
          <MenuBtn
            label="Add row above"
            disabled={!editor.isActive("table")}
            onClick={() => chain().addRowBefore().run()}
          />
          <MenuBtn
            label="Add row below"
            disabled={!editor.isActive("table")}
            onClick={() => chain().addRowAfter().run()}
          />
          <MenuBtn
            label="Delete row"
            disabled={!editor.isActive("table")}
            onClick={() => chain().deleteRow().run()}
          />
          <MenuBtn
            label="Add column left"
            disabled={!editor.isActive("table")}
            onClick={() => chain().addColumnBefore().run()}
          />
          <MenuBtn
            label="Add column right"
            disabled={!editor.isActive("table")}
            onClick={() => chain().addColumnAfter().run()}
          />
          <MenuBtn
            label="Delete column"
            disabled={!editor.isActive("table")}
            onClick={() => chain().deleteColumn().run()}
          />
          <MenuBtn
            label="Toggle header row"
            disabled={!editor.isActive("table")}
            onClick={() => chain().toggleHeaderRow().run()}
          />
          <MenuBtn
            label="Delete table"
            disabled={!editor.isActive("table")}
            onClick={() => chain().deleteTable().run()}
          />
        </div>
      </details>

      <span className="mx-1 h-5 w-px bg-[var(--border)]" />

      {btn(false, "u", "Undo", <Undo2 className="h-4 w-4" />, () =>
        chain().undo().run(),
        !editor.can().undo(),
      )}
      {btn(false, "r", "Redo", <Redo2 className="h-4 w-4" />, () =>
        chain().redo().run(),
        !editor.can().redo(),
      )}
    </div>
  );
}

/** Small labelled row for the table menu. */
function MenuBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md px-2 py-1.5 text-left text-sm text-[var(--muted)] hover:bg-black/5 hover:text-[var(--foreground)]",
        disabled && "opacity-30",
      )}
    >
      {label}
    </button>
  );
}

