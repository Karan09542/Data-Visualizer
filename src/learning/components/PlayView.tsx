import { useCallback, useState, type ComponentType } from "react";
import { Grid3x3 } from "lucide-react";
import { useLearningStore } from "../store/useLearningStore";
import type { ActiveGame, GameTypeId } from "../types";
import { CrosswordPlayer } from "./crossword/CrosswordPlayer";
import { ActionButton, EmptyState } from "./primitives";

export interface GamePlayerProps {
  game: ActiveGame;
  /** Called on every change; the store saves it shortly after. */
  onSave: (state: unknown) => void;
  /** Records the finished game. The player stays on screen until onContinue. */
  onFinish: (state: unknown) => void;
  onContinue: () => void;
  onDiscard: () => void;
}

/** One player component per game module. Register new games here alongside their module. */
const PLAYERS: Record<GameTypeId, ComponentType<GamePlayerProps>> = {
  crossword: CrosswordPlayer,
  // Word Wheel is a crossword with one fixed wheel; the same player handles both.
  wordwheel: CrosswordPlayer,
};

export function PlayView() {
  const active = useLearningStore((s) => s.active);
  const store = useLearningStore.getState;
  // Once a game is recorded the store clears it, but the finished board stays up for its
  // celebration until the player moves on.
  const [finished, setFinished] = useState<ActiveGame | null>(null);
  const game = active ?? finished;

  const onSave = useCallback((state: unknown) => store().saveGameState(state), [store]);
  const onFinish = useCallback(
    (state: unknown) => {
      const current = store().active;
      if (!current) return;
      setFinished({ ...current, state });
      store().finishGame(state);
    },
    [store],
  );
  const onContinue = useCallback(() => store().setView("results"), [store]);
  const onDiscard = useCallback(() => store().discardGame(), [store]);

  const Player = game ? PLAYERS[game.gameType] : undefined;
  if (!game || !Player) {
    return (
      <EmptyState
        icon={<Grid3x3 size={26} />}
        title="No game in progress"
        actions={
          <ActionButton variant="primary" onClick={() => store().setView("create")}>
            Create a game
          </ActionButton>
        }
      >
        Pick a set of words and build a crossword from them.
      </EmptyState>
    );
  }

  return <Player key={game.id} game={game} onSave={onSave} onFinish={onFinish} onContinue={onContinue} onDiscard={onDiscard} />;
}
