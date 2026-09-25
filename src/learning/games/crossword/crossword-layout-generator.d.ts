declare module "crossword-layout-generator" {
  export interface LayoutInput {
    answer: string;
    clue: string;
    [extra: string]: unknown;
  }

  export interface LayoutWord extends LayoutInput {
    /** 1-based column of the first letter; absent when the word was not placed. */
    startx?: number;
    /** 1-based row of the first letter; absent when the word was not placed. */
    starty?: number;
    orientation: "across" | "down" | "none";
    position?: number;
  }

  export interface Layout {
    table: string[][];
    result: LayoutWord[];
    rows: number;
    cols: number;
    table_string: string;
  }

  const generator: { generateLayout(words: LayoutInput[]): Layout };
  export default generator;
}
