// Turns an editor table into a picture, Markdown or CSV.
//
// It reads the rendered <table> rather than the Lexical tree, so merged cells, checklists and
// text all come straight from what the person can see. Drawing is done by hand on a canvas: the
// project has no screenshot dependency, and a table is simple enough to lay out properly.

export interface TableChecklistItem {
  text: string;
  checked: boolean;
}

export interface TableCellData {
  text: string;
  /** Checklist items found in the cell, which are drawn with real checkboxes */
  items: TableChecklistItem[];
  isHeader: boolean;
  colSpan: number;
  rowSpan: number;
}

export interface TableData {
  rows: TableCellData[][];
  columnCount: number;
  /** A "To Do" / "Done" table, which gets a progress line under the picture */
  isTodo: boolean;
}

interface PlacedCell extends TableCellData {
  row: number;
  column: number;
}

/* ─────────────────────────── Reading the table ─────────────────────────── */

// Lexical marks checklist items with role="checkbox"; the theme classes are a fallback
const CHECKLIST_SELECTOR = 'li[role="checkbox"], li.lexical-checklist-checked, li.lexical-checklist-unchecked';

const readCell = (cell: HTMLTableCellElement): TableCellData => {
  const checkboxes = Array.from(cell.querySelectorAll(CHECKLIST_SELECTOR));
  const items: TableChecklistItem[] = checkboxes.map((item) => ({
    text: (item.textContent || '').trim(),
    checked:
      item.getAttribute('aria-checked') === 'true' || item.classList.contains('lexical-checklist-checked'),
  }));

  // Whatever is not part of the checklist still counts as text
  let text = '';
  if (items.length === 0) {
    text = (cell.innerText ?? cell.textContent ?? '').replace(/ /g, ' ').trim();
  } else {
    const clone = cell.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(CHECKLIST_SELECTOR).forEach((node) => node.remove());
    text = (clone.textContent || '').replace(/ /g, ' ').trim();
  }

  return {
    text,
    items,
    isHeader: cell.tagName === 'TH' || cell.classList.contains('editor-tableCellHeader'),
    colSpan: Math.max(1, cell.colSpan || 1),
    rowSpan: Math.max(1, cell.rowSpan || 1),
  };
};

export const extractTableData = (table: HTMLTableElement): TableData => {
  const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map(readCell));

  // Spans mean a row's cell count is not its column count
  let columnCount = 0;
  const taken: boolean[][] = [];
  rows.forEach((cells, r) => {
    let c = 0;
    cells.forEach((cell) => {
      while (taken[r]?.[c]) c++;
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          (taken[r + dr] ||= [])[c + dc] = true;
        }
      }
      c += cell.colSpan;
    });
    columnCount = Math.max(columnCount, c);
  });

  const header = rows[0] || [];
  const isTodo =
    header.length === 2 &&
    header[0].text.trim().toLowerCase() === 'to do' &&
    header[1].text.trim().toLowerCase() === 'done';

  return { rows, columnCount: Math.max(1, columnCount), isTodo };
};

/** Places every cell on a grid, so spans land in the right column */
const placeCells = (data: TableData): PlacedCell[] => {
  const placed: PlacedCell[] = [];
  const taken: boolean[][] = [];

  data.rows.forEach((cells, row) => {
    let column = 0;
    cells.forEach((cell) => {
      while (taken[row]?.[column]) column++;
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          (taken[row + dr] ||= [])[column + dc] = true;
        }
      }
      placed.push({ ...cell, row, column });
      column += cell.colSpan;
    });
  });

  return placed;
};

/* ─────────────────────────── Text export ─────────────────────────── */

const cellToText = (cell: TableCellData) => {
  if (cell.items.length === 0) return cell.text;
  const list = cell.items.map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.text}`).join(' • ');
  return cell.text ? `${cell.text} ${list}` : list;
};

export const tableToMarkdown = (data: TableData) => {
  const lines = data.rows.map((cells) => {
    const values = cells.map((cell) => cellToText(cell).replace(/\|/g, '\\|').replace(/\n+/g, ' '));
    while (values.length < data.columnCount) values.push('');
    return `| ${values.join(' | ')} |`;
  });

  if (lines.length > 0) {
    lines.splice(1, 0, `| ${Array.from({ length: data.columnCount }, () => '---').join(' | ')} |`);
  }
  return lines.join('\n');
};

export const tableToCsv = (data: TableData) =>
  data.rows
    .map((cells) => {
      const values = cells.map((cell) => {
        const value = cellToText(cell).replace(/\n+/g, ' ');
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      });
      while (values.length < data.columnCount) values.push('');
      return values.join(',');
    })
    .join('\n');

/* ─────────────────────────── Drawing ─────────────────────────── */

const FONT = '"Segoe UI", Inter, system-ui, -apple-system, sans-serif';
const SCALE = 2;
const PADDING_X = 14;
const PADDING_Y = 11;
const LINE_HEIGHT = 21;
const ITEM_GAP = 6;
const CHECKBOX = 14;
const MIN_COLUMN = 96;
const MAX_COLUMN = 340;
const MAX_TABLE_WIDTH = 1100;
const MARGIN = 28;

const COLORS = {
  page: '#ffffff',
  headerFill: '#f1f5f9',
  headerText: '#0f172a',
  rowFill: '#ffffff',
  rowAltFill: '#f8fafc',
  text: '#1e293b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  outline: '#cbd5e1',
  done: '#059669',
};

const bodyFont = (weight = 400, size = 14) => `${weight} ${size}px ${FONT}`;

/** Splits text to fit a width, breaking inside a word only when it cannot fit at all */
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        if (ctx.measureText(candidate).width > maxWidth && !line) {
          // A single word wider than the column: break it by characters
          let chunk = '';
          for (const char of word) {
            if (ctx.measureText(chunk + char).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = char;
            } else {
              chunk += char;
            }
          }
          line = chunk;
          continue;
        }
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines.length > 0 ? lines : [''];
};

const measureCellWidth = (ctx: CanvasRenderingContext2D, cell: TableCellData) => {
  ctx.font = bodyFont(cell.isHeader ? 700 : 400);
  let widest = ctx.measureText(cell.text).width;
  for (const item of cell.items) {
    widest = Math.max(widest, ctx.measureText(item.text).width + CHECKBOX + 8);
  }
  return widest + PADDING_X * 2;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const drawCheckbox = (ctx: CanvasRenderingContext2D, x: number, y: number, checked: boolean) => {
  roundRect(ctx, x, y, CHECKBOX, CHECKBOX, 4);
  if (checked) {
    ctx.fillStyle = COLORS.done;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 3.5, y + 7.5);
    ctx.lineTo(x + 6, y + 10);
    ctx.lineTo(x + 10.5, y + 4.5);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

export const renderTableToCanvas = (data: TableData): HTMLCanvasElement | null => {
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return null;

  const placed = placeCells(data);
  const { columnCount } = data;

  // Column widths come from the cells that sit in a single column
  const columnWidths = new Array(columnCount).fill(MIN_COLUMN);
  placed.forEach((cell) => {
    if (cell.colSpan !== 1) return;
    const needed = Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, measureCellWidth(measureCtx, cell)));
    columnWidths[cell.column] = Math.max(columnWidths[cell.column], needed);
  });

  const naturalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  if (naturalWidth > MAX_TABLE_WIDTH) {
    const ratio = MAX_TABLE_WIDTH / naturalWidth;
    for (let i = 0; i < columnCount; i++) {
      columnWidths[i] = Math.max(MIN_COLUMN, Math.floor(columnWidths[i] * ratio));
    }
  }

  const columnOffsets: number[] = [];
  let offset = 0;
  for (let i = 0; i < columnCount; i++) {
    columnOffsets.push(offset);
    offset += columnWidths[i];
  }
  const tableWidth = offset;

  const spanWidth = (cell: PlacedCell) => {
    let width = 0;
    for (let i = cell.column; i < Math.min(columnCount, cell.column + cell.colSpan); i++) width += columnWidths[i];
    return width;
  };

  // Lay out the text now, so heights are known before anything is drawn
  const layouts = new Map<PlacedCell, { lines: string[]; items: { lines: string[]; checked: boolean }[] }>();
  placed.forEach((cell) => {
    const inner = spanWidth(cell) - PADDING_X * 2;
    measureCtx.font = bodyFont(cell.isHeader ? 700 : 400);
    const lines = cell.text ? wrapText(measureCtx, cell.text, inner) : [];
    const items = cell.items.map((item) => ({
      lines: wrapText(measureCtx, item.text || ' ', inner - CHECKBOX - 8),
      checked: item.checked,
    }));
    layouts.set(cell, { lines, items });
  });

  const contentHeight = (cell: PlacedCell) => {
    const layout = layouts.get(cell)!;
    let height = layout.lines.length * LINE_HEIGHT;
    layout.items.forEach((item, index) => {
      height += item.lines.length * LINE_HEIGHT + (index > 0 ? ITEM_GAP : layout.lines.length > 0 ? ITEM_GAP : 0);
    });
    return height + PADDING_Y * 2;
  };

  const rowHeights = new Array(data.rows.length).fill(0);
  placed.forEach((cell) => {
    if (cell.rowSpan !== 1) return;
    rowHeights[cell.row] = Math.max(rowHeights[cell.row], contentHeight(cell), 40);
  });
  for (let r = 0; r < rowHeights.length; r++) if (!rowHeights[r]) rowHeights[r] = 40;

  // Give a tall spanning cell room by growing the last row it covers
  placed.forEach((cell) => {
    if (cell.rowSpan === 1) return;
    let available = 0;
    for (let r = cell.row; r < Math.min(rowHeights.length, cell.row + cell.rowSpan); r++) available += rowHeights[r];
    const needed = contentHeight(cell);
    if (needed > available) {
      rowHeights[Math.min(rowHeights.length - 1, cell.row + cell.rowSpan - 1)] += needed - available;
    }
  });

  const rowOffsets: number[] = [];
  let y = 0;
  rowHeights.forEach((height) => {
    rowOffsets.push(y);
    y += height;
  });
  const tableHeight = y;

  const footerHeight = data.isTodo ? 30 : 0;
  const width = tableWidth + MARGIN * 2;
  const height = tableHeight + MARGIN * 2 + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'top';

  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, width, height);

  // Body fills first, then the cells, then one outline on top
  ctx.save();
  roundRect(ctx, MARGIN, MARGIN, tableWidth, tableHeight, 12);
  ctx.clip();

  rowHeights.forEach((rowHeight, r) => {
    ctx.fillStyle = r === 0 ? COLORS.headerFill : r % 2 === 0 ? COLORS.rowAltFill : COLORS.rowFill;
    ctx.fillRect(MARGIN, MARGIN + rowOffsets[r], tableWidth, rowHeight);
  });

  placed.forEach((cell) => {
    const x = MARGIN + columnOffsets[cell.column];
    const top = MARGIN + rowOffsets[cell.row];
    const cellWidth = spanWidth(cell);
    let cellHeight = 0;
    for (let r = cell.row; r < Math.min(rowHeights.length, cell.row + cell.rowSpan); r++) cellHeight += rowHeights[r];

    if (cell.isHeader && cell.row !== 0) {
      ctx.fillStyle = COLORS.headerFill;
      ctx.fillRect(x, top, cellWidth, cellHeight);
    }

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, top + 0.5, cellWidth - 1, cellHeight - 1);

    const layout = layouts.get(cell)!;
    let textY = top + PADDING_Y;

    if (layout.lines.length > 0) {
      ctx.font = bodyFont(cell.isHeader ? 700 : 400);
      ctx.fillStyle = cell.isHeader ? COLORS.headerText : COLORS.text;
      layout.lines.forEach((line) => {
        ctx.fillText(line, x + PADDING_X, textY);
        textY += LINE_HEIGHT;
      });
      if (layout.items.length > 0) textY += ITEM_GAP;
    }

    layout.items.forEach((item, index) => {
      if (index > 0) textY += ITEM_GAP;
      drawCheckbox(ctx, x + PADDING_X, textY + 3, item.checked);

      ctx.font = bodyFont(400);
      ctx.fillStyle = item.checked ? COLORS.muted : COLORS.text;
      const textX = x + PADDING_X + CHECKBOX + 8;
      item.lines.forEach((line) => {
        ctx.fillText(line, textX, textY);
        if (item.checked && line) {
          // Done items are struck through, the same as in the editor
          const lineWidth = ctx.measureText(line).width;
          ctx.strokeStyle = COLORS.muted;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(textX, textY + LINE_HEIGHT / 2);
          ctx.lineTo(textX + lineWidth, textY + LINE_HEIGHT / 2);
          ctx.stroke();
        }
        textY += LINE_HEIGHT;
      });
    });
  });

  ctx.restore();

  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 1;
  roundRect(ctx, MARGIN + 0.5, MARGIN + 0.5, tableWidth - 1, tableHeight - 1, 12);
  ctx.stroke();

  if (data.isTodo) {
    let done = 0;
    let total = 0;
    data.rows.slice(1).forEach((cells) => {
      cells.forEach((cell) => {
        cell.items.forEach((item) => {
          total++;
          if (item.checked) done++;
        });
      });
    });
    ctx.font = bodyFont(600, 12);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(
      total > 0 ? `${done} of ${total} done` : 'Nothing to do yet',
      MARGIN,
      MARGIN + tableHeight + 10,
    );
  }

  return canvas;
};

/* ─────────────────────────── Sharing it out ─────────────────────────── */

export const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), 'image/png'),
  );

export const downloadCanvas = (canvas: HTMLCanvasElement, fileName: string) => {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

/** Copies the picture, falling back to a download where the browser will not allow it */
export const copyCanvas = async (canvas: HTMLCanvasElement, fileName: string) => {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      throw new Error('Copying images is not supported here');
    }
    // Handing over the promise keeps Safari happy, it wants the write to start right away
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(canvas) })]);
    return 'copied' as const;
  } catch (err) {
    console.warn('Copying the table image failed, downloading it instead', err);
    downloadCanvas(canvas, fileName);
    return 'downloaded' as const;
  }
};

export const canShareImages = () => {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob([''], { type: 'image/png' })], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
};

/**
 * Builds the file without awaiting. Sharing has to be called straight out of the click that
 * asked for it, and an await in between loses that permission on iOS.
 */
export const canvasToFile = (canvas: HTMLCanvasElement, fileName: string) => {
  const dataUrl = canvas.toDataURL('image/png');
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: 'image/png' });
};

export const shareCanvas = async (canvas: HTMLCanvasElement, fileName: string, title: string) => {
  const file = canvasToFile(canvas, fileName);
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported' as const;
  try {
    await navigator.share({ files: [file], title });
    return 'shared' as const;
  } catch (err) {
    // Dismissing the share sheet lands here
    if ((err as Error)?.name === 'AbortError') return 'cancelled' as const;
    throw err;
  }
};
