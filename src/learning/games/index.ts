/** Registers every available game. Import this once before using the GameGenerator. */
import { registerGame } from "./GameGenerator";
import { crosswordModule } from "./crossword/CrosswordGame";
import { wordWheelModule } from "./crossword/WordWheelGame";

registerGame(wordWheelModule);
registerGame(crosswordModule);

export { crosswordModule, wordWheelModule };
export * from "./GameGenerator";
export type * from "./types";
