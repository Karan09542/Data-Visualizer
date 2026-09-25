/**
 * The only file that talks to crossword-layout-generator. It decides where words go; numbering,
 * clues and play are ours.
 */
import generator from "crossword-layout-generator";

export type Direction = "across" | "down";

export interface LayoutItem {
  key: string;
  answer: string;
}

export interface PlacedWord {
  key: string;
  answer: string;
  /** 0-based. */
  row: number;
  /** 0-based. */
  col: number;
  direction: Direction;
}

export interface RawLayout {
  rows: number;
  cols: number;
  placed: PlacedWord[];
  unplaced: string[];
}

const EMPTY: RawLayout = { rows: 0, cols: 0, placed: [], unplaced: [] };

/**
 * Lays out the answers. Words that cannot cross any other word are returned in `unplaced`,
 * because the generator drops isolated words rather than leaving them floating.
 */
export function buildLayout(items: readonly LayoutItem[]): RawLayout {
  // The generator indexes into an empty table when given nothing to place.
  if (items.length < 2) return { ...EMPTY, unplaced: items.map((i) => i.key) };

  // It mutates its input, so hand it copies.
  const input = items.map((i) => ({ answer: i.answer, clue: "", key: i.key }));
  // It also logs every placement; keep the console clean. The call is synchronous, so nothing
  // else can log in between.
  const log = console.log;
  console.log = () => {};
  let layout: ReturnType<typeof generator.generateLayout>;
  try {
    layout = generator.generateLayout(input);
  } catch (e) {
    console.warn("[learning] crossword layout failed", e);
    return { ...EMPTY, unplaced: items.map((i) => i.key) };
  } finally {
    console.log = log;
  }

  const placed: PlacedWord[] = [];
  const unplaced: string[] = [];
  for (const w of layout.result) {
    const key = String(w.key);
    if (w.orientation === "none" || w.startx === undefined || w.starty === undefined) {
      unplaced.push(key);
      continue;
    }
    placed.push({ key, answer: w.answer, row: w.starty - 1, col: w.startx - 1, direction: w.orientation });
  }
  return { rows: layout.rows, cols: layout.cols, placed, unplaced };
}

/** Mirrors a layout across its diagonal, turning across words into down words and back. */
export function transpose(layout: RawLayout): RawLayout {
  return {
    rows: layout.cols,
    cols: layout.rows,
    unplaced: layout.unplaced,
    placed: layout.placed.map((p) => ({
      ...p,
      row: p.col,
      col: p.row,
      direction: p.direction === "across" ? "down" : "across",
    })),
  };
}
