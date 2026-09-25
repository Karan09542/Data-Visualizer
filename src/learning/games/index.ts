/** Registers every available game. Import this once before using the GameGenerator. */
import { registerGame } from "./GameGenerator";
import { crosswordModule } from "./crossword/CrosswordGame";

registerGame(crosswordModule);

export { crosswordModule };
export * from "./GameGenerator";
export type * from "./types";
