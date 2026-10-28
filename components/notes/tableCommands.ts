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
 * Heading toggle that understands cell selections: every selected cell's
 * blocks flip to the heading (or back to plain text if any of them is a
 * heading). Note this must use `$anchorCell`/`$headCell`/`forEachCell`, NOT
 * the inherited `$anchor`/`$head` — for a CellSelection those hold only the
 * head cell's content range (end-of-cell, where nodeAfter is null). Outside
 * a cell selection it's the normal toggle.
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
  const { tr, schema } = state;
  let hasHeading = false;
  sel.forEachCell((cell) => {
    for (let i = 0; i < cell.childCount; i++) {
      if (cell.child(i).type.name === "heading") hasHeading = true;
    }
  });
  const type = hasHeading ? schema.nodes.paragraph : schema.nodes.heading;
  const attrs = hasHeading ? {} : { level };
  // Per cell, never one contiguous from/to: that range would spill into the
  // unselected cells of the rows in between (a column selection must not
  // re-format the columns it doesn't cover).
  sel.forEachCell((cell, pos) => {
    tr.setBlockType(pos + 1, pos + cell.nodeSize - 1, type, attrs);
  });
  editor.view.focus();
  editor.view.dispatch(tr);
}
