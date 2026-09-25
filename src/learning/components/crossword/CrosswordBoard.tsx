import React, { memo, useMemo } from "react";
import {
  activeEntry,
  cellLinks,
  type CrosswordPuzzle,
  type CrosswordState,
} from "../../games/crossword/CrosswordGame";

export interface BoardFlash {
  entryId: string;
  kind: "correct" | "wrong";
}

interface CrosswordBoardProps {
  puzzle: CrosswordPuzzle;
  state: CrosswordState;
  flash: BoardFlash | null;
  celebrating: boolean;
  /** CSS length the board must fit within vertically; omit to let it grow and scroll. */
  maxHeight?: string;
  onSelect: (cell: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  boardRef: React.RefObject<HTMLDivElement | null>;
}

export const CrosswordBoard = memo(function CrosswordBoard({
  puzzle,
  state,
  flash,
  celebrating,
  maxHeight,
  onSelect,
  onKeyDown,
  boardRef,
}: CrosswordBoardProps) {
  const { rows, cols, solution, numbers, entries } = puzzle;
  const links = cellLinks(puzzle);
  const entry = activeEntry(puzzle, state);
  const wordCells = useMemo(() => new Set(entry?.cells ?? []), [entry]);
  const solvedCells = useMemo(() => {
    const set = new Set<number>();
    entries.forEach((e) => state.solved.includes(e.id) && e.cells.forEach((c) => set.add(c)));
    return set;
  }, [entries, state.solved]);
  const flashCells = useMemo(() => {
    const map = new Map<number, number>();
    const e = flash && entries.find((x) => x.id === flash.entryId);
    e?.cells.forEach((c, i) => map.set(c, i));
    return map;
  }, [flash, entries]);

  const describe = (cell: number) => {
    const parts: string[] = [];
    const a = links[cell].across >= 0 ? entries[links[cell].across] : null;
    const d = links[cell].down >= 0 ? entries[links[cell].down] : null;
    if (a) parts.push(`${a.number} across, letter ${a.cells.indexOf(cell) + 1} of ${a.cells.length}`);
    if (d) parts.push(`${d.number} down, letter ${d.cells.indexOf(cell) + 1} of ${d.cells.length}`);
    const letter = state.letters[cell];
    parts.push(letter ? `${letter}${solvedCells.has(cell) ? ", correct" : state.wrong[cell] ? ", incorrect" : ""}` : "blank");
    return parts.join("; ");
  };

  return (
    <div
      ref={boardRef}
      role="grid"
      aria-label={`Crossword, ${rows} rows by ${cols} columns`}
      aria-activedescendant={`lg-cell-${state.cursor.cell}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="lg-board"
      data-celebrate={celebrating || undefined}
      style={
        {
          "--cols": cols,
          "--rows": rows,
          ...(maxHeight ? { "--board-max-h": maxHeight } : {}),
        } as React.CSSProperties
      }
    >
      {Array.from({ length: rows }, (_, r) => (
        <div role="row" key={r} className="lg-board-row">
          {Array.from({ length: cols }, (_, c) => {
            const cell = r * cols + c;
            if (solution[cell] == null) {
              return <div key={c} role="gridcell" aria-hidden className="lg-cell" data-block="true" />;
            }
            const letter = state.letters[cell];
            const isCursor = state.cursor.cell === cell;
            const flashIndex = flashCells.get(cell);
            const flashKind = flashIndex === undefined ? undefined : flash!.kind === "wrong" && !state.wrong[cell] ? undefined : flash!.kind;
            return (
              <div
                key={c}
                id={`lg-cell-${cell}`}
                role="gridcell"
                aria-selected={isCursor}
                aria-label={describe(cell)}
                className="lg-cell"
                data-cursor={isCursor || undefined}
                data-word={wordCells.has(cell) || undefined}
                data-solved={solvedCells.has(cell) || undefined}
                data-wrong={state.wrong[cell] || undefined}
                data-mark={state.marks[cell] || undefined}
                data-flash={flashKind}
                style={{ "--i": flashIndex ?? 0, "--d": r + c } as React.CSSProperties}
                onClick={() => onSelect(cell)}
              >
                {numbers[cell] != null && <span className="lg-cell-num">{numbers[cell]}</span>}
                {letter && (
                  <span key={letter} className="lg-cell-letter lg-pop">
                    {letter}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
