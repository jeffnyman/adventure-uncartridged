// Game logic.

import { readResetSwitch, readSelectSwitch } from "./hardware";
import { GameState } from "./types";

let switchReset: boolean;
let switchSelect: boolean;
let gameState: GameState = GameState.GameSelect;

export function startGame(): void {
  const reset = readResetSwitch();
  const select = readSelectSwitch();

  if (gameState !== GameState.Win && switchReset && !reset) {
    // handle a reset action
  } else if (gameState === GameState.GameSelect) {
    // handle a select action
  } else if (isGameActive()) {
    // handle game actions
  } else if (gameState === GameState.Win) {
    TickWinState(reset, select);
  }

  switchReset = reset;
  switchSelect = select;
}

function TickWinState(reset: boolean, select: boolean): void {
  // Either switch released exits the win state and goes back to
  // the level selection.
  if ((switchReset && !reset) || (switchSelect && !select)) {
    gameState = GameState.GameSelect;
  }
}

function isGameActive() {
  return (
    gameState === GameState.Active1 ||
    gameState === GameState.Active2 ||
    gameState === GameState.Active3
  );
}
