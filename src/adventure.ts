// Game logic.

import { paintPixel, random, readResetSwitch, readSelectSwitch, roomColor } from "./hardware";
import { GameState, ObjectId } from "./types";
import {
  roomBoundsData,
  roomDefs,
  ROOMFLAG_LEFTTHINWALL,
  ROOMFLAG_MIRROR,
  ROOMFLAG_RIGHTTHINWALL,
} from "./data/rooms";
import { COLOR_BLACK, COLOR_FLASH, COLOR_LTGRAY, colorTable, type COLOR } from "./data/colors";
import type { OBJECT, ROOM } from "./types";
import {
  CLOCKS_HSYNC,
  CLOCKS_VSYNC,
  MAX_DISPLAY_OBJECTS,
  MAX_OBJECTS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TOTAL_HEIGHT,
} from "./constants";
import { game1Objects, game2Objects, objectBall, objectDefs } from "./data/objects";

let switchReset: boolean;
let switchSelect: boolean;
let gameState: GameState = GameState.GameSelect;
let displayedRoomIndex: number = 0;
let displayedListIndex: number = 0;
let showObjectFlicker: boolean = true;
let flashColorHue: number = 0;
let flashColorLum: number = 0;
let gameLevel: number = 0;

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
      printDisplay();
      ++gameState;
    } else if (gameState === GameState.Active2) {
      printDisplay();
      ++gameState;
    } else if (gameState === GameState.Active3) {
      printDisplay();
      gameState = GameState.Active1;
    }
  }
}

function tickResetState(): void {
  objectBall.room = 0x11;
  objectBall.x = 0x50 * 2;
  objectBall.y = 0x20 * 2;
  objectBall.previousX = objectBall.x;
  objectBall.previousY = objectBall.y;
  objectBall.linkedObject = ObjectId.None;

  displayedRoomIndex = objectBall.room;

  if (gameState === GameState.GameSelect) {
    // Re-initialize level. Full game reset.
    setupRoomObjects();
  } else {
    // Mid-game reset. The only thing that happens here are the
    // dragons are reset, without doing a re-initializing of the
    // entire level.
    objectDefs[ObjectId.YellowDragon].state = 0x0;
    objectDefs[ObjectId.GreenDragon].state = 0x0;
    objectDefs[ObjectId.RedDragon].state = 0x0;

    objectDefs[ObjectId.YellowDragon].linkedObject = ObjectId.None;
    objectDefs[ObjectId.GreenDragon].linkedObject = ObjectId.None;
    objectDefs[ObjectId.RedDragon].linkedObject = ObjectId.None;
  }

  gameState = GameState.Active1;
}

function tickSelectState(select: boolean): void {
  objectDefs[ObjectId.Number].state = gameLevel;

  if (switchSelect && !select) {
    ++gameLevel;

    if (gameLevel > 2) {
      gameLevel = 0;
    }
  }

  displayedRoomIndex = 0;

  objectBall.room = 0;
  objectBall.x = 0;
  objectBall.y = 0;

  printDisplay();
}

function tickWinState(reset: boolean, select: boolean): void {
  // Either switch released exits the win state and goes back to
  // the level selection.
  if ((switchReset && !reset) || (switchSelect && !select)) {
    gameState = GameState.GameSelect;
  }
}

function setupRoomObjects() {
  for (let i = 0; objectDefs[i].graphicsData; i++) {
    let object: OBJECT = objectDefs[i];

    object.movementX = 0;
    object.movementY = 0;
    object.linkedObject = ObjectId.None;
  }

  const p: number[] = gameLevel === 0 ? game1Objects : game2Objects;
  let i = 0;

  while (p[i] !== 0xff) {
    let object = p[i++];
    let room = p[i++];
    let xpos = p[i++];
    let ypos = p[i++];
    let state = p[i++];
    let movementX = p[i++];
    let movementY = p[i++];

    objectDefs[object].room = room;
    objectDefs[object].x = xpos;
    objectDefs[object].y = ypos;
    objectDefs[object].state = state;
    objectDefs[object].movementX = movementX;
    objectDefs[object].movementY = movementY;
  }

  if (gameLevel === 2) {
    const boundsData: number[] = roomBoundsData;

    let i = 0;
    let object = boundsData[i++];
    let lower = boundsData[i++];
    let upper = boundsData[i++];

    do {
      while (true) {
        let room = random() * 0x1f;

        if (room >= lower && room <= upper) {
          objectDefs[object].room = room;
          break;
        }
      }

      object = boundsData[i++];
      lower = boundsData[i++];
      upper = boundsData[i++];
    } while (object > ObjectId.None);
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

  drawObjects(displayedRoom);
}

// This function holds the frame's actual render pass.
function drawObjects(room: number): void {
  const {
    displayList,
    numAdded,
    colorFirst,
    colorLast: colorLastInitial,
  } = buildRoomDisplayList(room);

  let colorLast = colorLastInitial;

  resolveDisplayList(displayList, numAdded);

  let numDisplayed = 0;
  let i = displayedListIndex;

  while (numDisplayed++ < numAdded && numDisplayed <= MAX_DISPLAY_OBJECTS) {
    if (displayList[i] > ObjectId.None) {
      if (showObjectFlicker) {
        drawObject(objectDefs[displayList[i]]);
      }

      objectDefs[displayList[i]].displayed = true;
      colorLast = objectDefs[displayList[i]].color;
    }

    // Wrap to the beginning of the list if the end is reached.
    ++i;

    if (i > MAX_OBJECTS) {
      i = 0;
    } else if (displayList[i] === ObjectId.None) {
      i = 0;
    }
  }

  if (!showObjectFlicker) {
    for (let i = 0; objectDefs[i].graphicsData; i++) {
      if (objectDefs[i].room === room) {
        drawObject(objectDefs[i]);
      }
    }
  }

  drawThinWalls(room, colorFirst, colorLast);
}

function drawObject(object: OBJECT) {
  let color: COLOR = object.color === COLOR_FLASH ? getFlashColor() : colorTable[object.color];
  let cx = object.x * 2;
  let cy = object.y * 2;
  let size = object.size / 2 + 1;
  let stateIndex = object.states[object.state];

  const dataP = object.graphicsData!;
  let i = 0;
  let objHeight = dataP[i++];

  for (let x = 0; x < stateIndex; x++) {
    i += objHeight;
    objHeight = dataP[i++];
  }

  cx -= CLOCKS_HSYNC;
  cy -= CLOCKS_VSYNC;

  for (let j = 0; j < objHeight; j++) {
    for (let bit = 0; bit < 8; bit++) {
      if (dataP[i] & (1 << (7 - bit))) {
        let x = cx + bit * 2 * size;

        if (x >= SCREEN_WIDTH) {
          x -= SCREEN_WIDTH;
        }

        paintPixel(color.r, color.g, color.b, x, cy, 2 * size, 2);
      }
    }

    i++;
    cy -= 2;
  }
}

function drawThinWalls(room: number, colorFirst: number, colorLast: number): void {
  if (roomDefs[room].flags & ROOMFLAG_LEFTTHINWALL) {
    const color: COLOR = colorTable[colorFirst > 0 ? colorFirst : COLOR_BLACK];

    paintPixel(color.r, color.g, color.b, 0x0d * 2, 0x00, 4, SCREEN_HEIGHT);
  }

  if (roomDefs[room].flags & ROOMFLAG_RIGHTTHINWALL) {
    const color: COLOR = colorTable[colorFirst > 0 ? colorLast : COLOR_BLACK];
    paintPixel(color.r, color.g, color.b, 0x96 * 2, 0x00, 4, SCREEN_HEIGHT);
  }
}

function resolveDisplayList(displayList: number[], numAdded: number): void {
  if (numAdded <= MAX_DISPLAY_OBJECTS) {
    displayedListIndex = 0;
  } else {
    if (displayedListIndex > numAdded) {
      displayedListIndex = 0;
    }

    if (displayedListIndex > MAX_OBJECTS) {
      displayedListIndex = 0;
    }

    if (displayList[displayedListIndex] === ObjectId.None) {
      displayedListIndex = 0;
    }
  }
}

function buildRoomDisplayList(room: number): {
  displayList: number[];
  numAdded: number;
  colorFirst: number;
  colorLast: number;
} {
  const displayList: number[] = [];
  let numAdded = 0;
  let colorFirst = -1;
  let colorLast = -1;

  for (let i = 0; i < MAX_OBJECTS; i++) {
    displayList.push(ObjectId.None);
  }

  for (let i = 0; objectDefs[i].graphicsData; i++) {
    objectDefs[i].displayed = false;

    if (objectDefs[i].room === room) {
      displayList[numAdded++] = i;

      if (colorFirst < 0) {
        colorFirst = objectDefs[i].color;
      }

      colorLast = objectDefs[i].color;
    }
  }

  return { displayList, numAdded, colorFirst, colorLast };
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

function getFlashColor(): COLOR {
  let r = 0,
    g = 0,
    b = 0;
  let h = flashColorHue / (360.0 / 3);

  if (h < 1) {
    r = h * 255;
    g = 0;
    b = (1 - h) * 255;
  } else if (h < 2) {
    h -= 1;
    r = (1 - h) * 255;
    g = h * 255;
    b = 0;
  } else {
    h -= 2;
    r = 0;
    g = (1 - h) * 255;
    b = h * 255;
  }

  let color: COLOR = {
    r: Math.max(flashColorLum, r),
    g: Math.max(flashColorLum, g),
    b: Math.max(flashColorLum, b),
  };

  return color;
}
