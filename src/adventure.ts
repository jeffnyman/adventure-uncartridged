// Game logic.

import { paintPixel, readResetSwitch, readSelectSwitch, roomColor } from "./hardware";
import { GameState } from "./types";
import { ROOMFLAG_MIRROR, ROOMFLAG_NONE, roomGfxNumberRoom } from "./data/rooms";
import { COLOR_LTGRAY, COLOR_PURPLE, colorTable, type COLOR } from "./data/colors";
import type { ROOM } from "./types";
import { SCREEN_WIDTH, TOTAL_HEIGHT } from "./constants";

let switchReset: boolean;
let switchSelect: boolean;
let gameState: GameState = GameState.GameSelect;
let displayedRoomIndex: number = 0;

// Indexed array of all rooms and their properties.
let roomDefs: ROOM[] = [
  {
    graphicsData: roomGfxNumberRoom,
    flags: ROOMFLAG_NONE,
    color: COLOR_PURPLE,
    roomUp: 0x00,
    roomRight: 0x00,
    roomDown: 0x00,
    roomLeft: 0x00,
  }, // 0 - Number Room
];

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

  displayedRoomIndex = 0;
  printDisplay();
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

function printDisplay(): void {
  let displayedRoom = displayedRoomIndex;
  const currentRoom: ROOM = roomDefs[displayedRoom];
  const roomData = currentRoom.graphicsData;
  let color: COLOR = colorTable[currentRoom.color];
  let colorBackground: COLOR = colorTable[COLOR_LTGRAY];

  // Tell the hardware what the current room color is.
  roomColor(color);

  // Fill the entire backbuffer with the playfield background color
  // before anything else is drawn.
  paintPixel(
    colorBackground.r,
    colorBackground.g,
    colorBackground.b,
    0,
    0,
    SCREEN_WIDTH,
    TOTAL_HEIGHT,
  );

  let mirror = currentRoom.flags & ROOMFLAG_MIRROR;

  const cell_width = 8;
  const cell_height = 32;

  setPlayfieldBit(roomData, (cx, ypos) => {
    paintPixel(
      color.r,
      color.g,
      color.b,
      cx * cell_width,
      ypos * cell_height,
      cell_width,
      cell_height,
    );

    if (mirror) {
      paintPixel(
        color.r,
        color.g,
        color.b,
        (cx + 20) * cell_width,
        ypos * cell_height,
        cell_width,
        cell_height,
      );
    } else {
      paintPixel(
        color.r,
        color.g,
        color.b,
        (40 - (cx + 1)) * cell_width,
        ypos * cell_height,
        cell_width,
        cell_height,
      );
    }
  });
}

// Iterates over every set bit in the room's 20-column playfield,
// calling callback(cx, ypos) for each. The function can return true
// from the callback to stop early. The playfield register is 20
// bits wide encoded across 3 bytes:
//
//    PF0   |  PF1   |  PF2
//  xxxx4567|76543210|01234567
//
// PF0 uses only its high nibble (bits 4–7) and is read LSB→MSB;
// PF1 is read MSB→LSB; PF2 reverses back to LSB→MSB.
function setPlayfieldBit(
  roomData: number[],
  callback: (cx: number, ypos: number) => boolean | void,
): void {
  const shiftreg = [
    0x10, 0x20, 0x40, 0x80, 0x80, 0x40, 0x20, 0x10, 0x8, 0x4, 0x2, 0x1, 0x1, 0x2, 0x4, 0x8, 0x10,
    0x20, 0x40, 0x80,
  ];

  for (let cy = 0; cy <= 6; cy++) {
    const pf0 = roomData[cy * 3 + 0];
    const pf1 = roomData[cy * 3 + 1];
    const pf2 = roomData[cy * 3 + 2];
    const ypos = 6 - cy;

    for (let cx = 0; cx < 20; cx++) {
      let bit = false;

      if (cx < 4) bit = pf0 & shiftreg[cx] ? true : false;
      else if (cx < 12) bit = pf1 & shiftreg[cx] ? true : false;
      else bit = pf2 & shiftreg[cx] ? true : false;

      if (bit && callback(cx, ypos) === true) return;
    }
  }
}
