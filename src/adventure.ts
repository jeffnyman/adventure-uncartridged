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
    tickResetState();
  } else if (gameState === GameState.GameSelect) {
    tickSelectState(select);
  } else if (isGameActive()) {
    tickActiveGameState(select);
  } else if (gameState === GameState.Win) {
    tickWinState(reset, select);
  }

  switchReset = reset;
  switchSelect = select;
}

function tickActiveGameState(select: boolean): void {
  if (switchSelect && !select) {
    // Select was released mid-game.
    gameState = GameState.GameSelect;
  } else {
    // Core level logic.
    if (gameState === GameState.Active1) {
      // handle level 1
    } else if (gameState === GameState.Active2) {
      // handle level 2
    } else if (gameState === GameState.Active3) {
      // handle level 3
    }
  }
}

function tickResetState(): void {
  if (gameState === GameState.GameSelect) {
    // Re-initialize level. Full game reset.
  } else {
    // Mid-game reset.
  }

  gameState = GameState.Active1;
}

function tickSelectState(select: boolean): void {
  if (switchSelect && !select) {
    // handle level selection
  }
}

function tickWinState(reset: boolean, select: boolean): void {
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
