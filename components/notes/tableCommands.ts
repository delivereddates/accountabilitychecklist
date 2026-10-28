import type { Editor } from "@tiptap/react";
import { CellSelection, findTable } from "@tiptap/pm/tables";
import type { ResolvedPos } from "@tiptap/pm/model";

/**
 * Cell-selection commands for note tables. "Select row / column / table"
 * put a ProseMirror CellSelection around the cursor's row, column, or the
 * whole table (painted via .selectedCell), so the regular toolbar buttons —
 * headings, bold — then apply to every cell at once. On a phone this is the
 * only practical way to select a table; it also repairs the "select-all +
 * heading" accident that turns every cell big and bold.
 */

/** Doc position of the cell (td/th) the cursor is in, or -1. */
function cellPosOf($from: ResolvedPos): number {
  for (let d = $from.depth; d >= 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "tableCell" || name === "tableHeader") return $from.before(d);
  }
  return -1;
}

export function selectWholeTable(editor: Editor): void {
  const { tr, selection } = editor.state;
  const hit = findTable(tr.doc.resolve(selection.from));
  if (!hit) return;
  // Corner cells: first child of the first row, last child of the last row.
  const firstRow = hit.node.firstChild;
  const lastRow = hit.node.lastChild;
  if (!firstRow || !lastRow) return;
  const firstCell = hit.pos + 2; // enter table content, enter first row
  const lastRowStart = hit.pos + hit.node.nodeSize - 1 - lastRow.nodeSize;
  const lastCell =
    lastRowStart + lastRow.nodeSize - 1 - lastRow.lastChild!.nodeSize;
  editor.view.dispatch(
    tr.setSelection(
      new CellSelection(tr.doc.resolve(firstCell), tr.doc.resolve(lastCell)),
    ),
  );
}

export function selectRow(editor: Editor): void {
  const { tr, doc, selection } = editor.state;
  const cell = cellPosOf(selection.$from);
  if (cell < 0) return;
  editor.view.dispatch(
    tr.setSelection(CellSelection.rowSelection(doc.resolve(cell))),
  );
}

export function selectColumn(editor: Editor): void {
  const { tr, doc, selection } = editor.state;
  const cell = cellPosOf(selection.$from);
  if (cell < 0) return;
  editor.view.dispatch(
    tr.setSelection(CellSelection.colSelection(doc.resolve(cell))),
  );
}

/**
 * Heading toggle that understands cell selections: the whole selected range
 * flips to the heading (or back to plain text if any part of it is a
 * heading). setBlockType walks into table cells — the same behavior that
 * lets select-all + H2 hit every cell — so it covers each selected cell.
 * Outside a cell selection it's the normal toggle.
 */
export function toggleHeadingSelection(
  editor: Editor,
  level: 2 | 3,
): void {
  const { state } = editor;
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) {
    editor.chain().focus().toggleHeading({ level }).run();
    return;
  }
  // Cover the last cell's content: plain sel.to stops at its start.
  const first = Math.min(sel.$anchor.pos, sel.$head.pos);
  const lastRes = sel.$anchor.pos >= sel.$head.pos ? sel.$anchor : sel.$head;
  const lastCell = lastRes.nodeAfter;
  if (!lastCell) return;
  const from = first + 1; // inside the first cell
  const to = lastRes.pos + lastCell.nodeSize - 1; // end of last cell content
  const { tr, schema } = state;
  let hasHeading = false;
  tr.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === "heading") hasHeading = true;
  });
  const type = hasHeading ? schema.nodes.paragraph : schema.nodes.heading;
  editor.view.dispatch(
    tr.setBlockType(from, to, type, hasHeading ? {} : { level }),
  );
}
