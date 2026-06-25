// Game logic.

import {
  paintPixel,
  random,
  readJoystick,
  readResetSwitch,
  readSelectSwitch,
  roomColor,
} from "./hardware";
import { GameState, ObjectId } from "./types";
import {
  castleRoomOffsets,
  entryRoomOffsets,
  roomBoundsData,
  roomDefs,
  ROOMFLAG_LEFTTHINWALL,
  ROOMFLAG_MIRROR,
  ROOMFLAG_RIGHTTHINWALL,
  roomLevelDiffs,
} from "./data/rooms";
import { COLOR_BLACK, COLOR_FLASH, COLOR_LTGRAY, colorTable, type COLOR } from "./data/colors";
import type { OBJECT, ROOM } from "./types";
import {
  CLOCKS_HSYNC,
  CLOCKS_VSYNC,
  MAX_DISPLAY_OBJECTS,
  MAX_OBJECTS,
  OVERSCAN,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TOTAL_HEIGHT,
} from "./constants";
import { game1Objects, game2Objects, objectBall, objectDefs, objectSurround } from "./data/objects";
import { joystick } from "./data/action";

let switchReset: boolean;
let switchSelect: boolean;
let gameState: GameState = GameState.GameSelect;
let displayedRoomIndex: number = 0;
let displayedListIndex: number = 0;
let showObjectFlicker: boolean = true;
let flashColorHue: number = 0;
let flashColorLum: number = 0;
let gameLevel: number = 0;
let winFlashTimer: number = 0;

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

    objectBall.room = 0;
    objectBall.x = 0;
    objectBall.y = 0;
    objectBall.previousX = objectBall.x;
    objectBall.previousY = objectBall.y;
    displayedRoomIndex = objectBall.room;

    printDisplay();
  } else {
    readJoystick(joystick);
    // Core level logic.
    if (gameState === GameState.Active1) {
      ballMovement();
      printDisplay();
      ++gameState;
    } else if (gameState === GameState.Active2) {
      pickupPutdown();
      resolveCollisions();
      ++displayedListIndex;
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
  if (winFlashTimer > 0) {
    --winFlashTimer;
  }

  printDisplay();

  // Either switch released exits the win state and goes back to
  // the level selection.
  if ((switchReset && !reset) || (switchSelect && !select)) {
    gameState = GameState.GameSelect;
  }
}

function crossingBridge(room: number, x: number, y: number): boolean {
  const bridge: OBJECT = objectDefs[ObjectId.Bridge];

  if (bridge.room == room && objectBall.linkedObject != ObjectId.Bridge) {
    let xDiff = x / 2 - bridge.x;

    if (xDiff >= 0x0a && xDiff <= 0x17) {
      let yDiff = bridge.y - y / 2;

      if (yDiff >= -5 && yDiff <= 0x15) {
        return true;
      }
    }
  }

  return false;
}

function pickupPutdown(): void {
  if (joystick.fire && objectBall.linkedObject >= 0) {
    // Put down the current object.
    objectBall.linkedObject = ObjectId.None;
  } else {
    // Determine if the player is touching any carryable object.
    let hitIndex = collisionCheckBallWithObjects(ObjectId.Sword);

    if (hitIndex > ObjectId.None) {
      // Ignore the object that is already being carried.
      if (hitIndex == objectBall.linkedObject) {
        // Check the remainder of the objects.
        hitIndex = collisionCheckBallWithObjects(hitIndex + 1);
      }

      if (hitIndex > ObjectId.None) {
        // Pick up the object.
        objectBall.linkedObject = hitIndex;

        // Calculate the XY offsets from the ball's position.
        objectBall.linkedObjectX = objectDefs[hitIndex].x - objectBall.x / 2;
        objectBall.linkedObjectY = objectDefs[hitIndex].y - objectBall.y / 2;
      }
    }
  }
}

function ballMovement(): void {
  const tempX = objectBall.x;
  const tempY = objectBall.y;

  // NOTE: This will need to be programmatic.
  const eaten: boolean = false;

  objectBall.previousY = objectBall.y;
  objectBall.hitObject = ObjectId.None;
  displayedRoomIndex = objectBall.room;

  if (joystick.up) objectBall.y += 6;
  if (joystick.down) objectBall.y -= 6;

  if (!eaten) {
    ballHandleYRoomWrap(tempX);
    ballCheckYCollision(tempX);
  } else {
    objectBall.hitY = true;
  }

  objectBall.previousX = objectBall.x;

  if (joystick.right) objectBall.x += 6;
  if (joystick.left) objectBall.x -= 6;

  if (!eaten) {
    ballHandleXRoomWrap();
    ballCheckXCollision(tempY);
  } else {
    objectBall.hitX = true;
  }
}

function ballEnterCastle(portId: number): void {
  objectBall.x = 0xa0;
  objectBall.y = 0x2c * 2;
  objectBall.previousX = objectBall.x;
  objectBall.previousY = objectBall.y;
  objectBall.room = adjustRoomLevel(castleRoomOffsets[portId]);
}

function ballHandleXRoomWrap() {
  if (objectBall.x >= SCREEN_WIDTH - 4) {
    objectBall.x = 5;
    objectBall.room = objectBall.room == 0x3 ? 0x1e : roomDefs[objectBall.room].roomRight;
    objectBall.room = adjustRoomLevel(objectBall.room);
  } else if (objectBall.x < 4) {
    objectBall.x = SCREEN_WIDTH - 5;
    objectBall.room = adjustRoomLevel(roomDefs[objectBall.room].roomLeft);
  }
}

function ballHandleYRoomWrap(tempX: number): void {
  if (objectBall.y > OVERSCAN + SCREEN_HEIGHT + 6) {
    objectBall.y = OVERSCAN + OVERSCAN - 2;
    objectBall.previousY = objectBall.y;
    objectBall.room = adjustRoomLevel(roomDefs[objectBall.room].roomUp);
  } else if (objectBall.y < 0x0d * 2) {
    if (objectBall.room == entryRoomOffsets[ObjectId.Port1]) {
      ballEnterCastle(ObjectId.Port1);
    } else if (objectBall.room == entryRoomOffsets[ObjectId.Port2]) {
      ballEnterCastle(ObjectId.Port2);
    } else if (objectBall.room == entryRoomOffsets[ObjectId.Port3]) {
      ballEnterCastle(ObjectId.Port3);
    } else {
      const newY = SCREEN_HEIGHT + OVERSCAN;
      const roomDown = adjustRoomLevel(roomDefs[objectBall.room].roomDown);

      if (collisionCheckBallWithWalls(roomDown, tempX, newY)) {
        objectBall.hitY = true;
        displayedRoomIndex = roomDown;
      } else {
        objectBall.y = newY;
        objectBall.room = roomDown;
      }
    }
  }
}

function ballCheckXCollision(tempY: number): void {
  const hitObject = collisionCheckBallWithObjects(0);
  const hitWall = collisionCheckBallWithWalls(objectBall.room, objectBall.x, tempY);

  if (hitWall || hitObject > ObjectId.None) {
    objectBall.hitX = true;
    objectBall.hitObject = hitObject;
  }
}

function ballCheckYCollision(tempX: number): void {
  const hitObject = collisionCheckBallWithObjects(0);
  const onBridge = crossingBridge(objectBall.room, tempX, objectBall.y);
  const hitWall = onBridge
    ? false
    : collisionCheckBallWithWalls(objectBall.room, tempX, objectBall.y);

  if (hitWall || hitObject > ObjectId.None) {
    objectBall.hitY = true;
    objectBall.hitObject = hitObject;
  }
}

export function collisionCheckObject(
  object: OBJECT,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  let objectX = object.x * 2;
  let objectY = object.y * 2;
  let objectSize = object.size / 2 + 1;
  let stateIndex = object.states[object.state];

  const dataP = object.graphicsData!;

  let i = 0;
  let objHeight = dataP[i++];

  for (let j = 0; j < stateIndex; j++) {
    i += objHeight;
    objHeight = dataP[i++];
  }

  objectX -= CLOCKS_HSYNC;

  for (let j = 0; j < objHeight; j++) {
    const rowByte = dataP[i];

    for (let bit = 0; bit < 8; bit++) {
      if (rowByte & (1 << (7 - bit))) {
        let wrappedX = objectX + bit * 2 * objectSize;

        if (wrappedX >= SCREEN_WIDTH) {
          wrappedX -= SCREEN_WIDTH;
        }

        if (hitTestRects(x, y, width, height, wrappedX, objectY, 2 * objectSize, 2)) {
          return true;
        }
      }
    }

    ++i;
    objectY -= 2;
  }

  return false;
}

function collisionCheckBallWithObjects(startIndex: number): number {
  for (let i = startIndex; objectDefs[i].graphicsData; i++) {
    const object: OBJECT = objectDefs[i];

    if (object.displayed && objectBall.room == object.room) {
      if (collisionCheckObject(object, objectBall.x - 4, objectBall.y - 1, 8, 8)) {
        return i;
      }
    }
  }

  return ObjectId.None;
}

function collisionCheckBallWithWalls(room: number, x: number, y: number): boolean {
  let hitWall = false;

  y -= 30;

  const currentRoom: ROOM = roomDefs[room];
  const roomData = currentRoom.graphicsData;
  const mirror = currentRoom.flags & ROOMFLAG_MIRROR;
  const cell_width = 8;
  const cell_height = 32;

  if (currentRoom.flags & ROOMFLAG_LEFTTHINWALL && x - (4 + 4) < 0x0d * 2) {
    hitWall = true;
  }

  if (currentRoom.flags & ROOMFLAG_RIGHTTHINWALL && x + 4 > 0x96 * 2) {
    if (objectDefs[ObjectId.Dot].room != room) {
      return hitWall;
    }
  }

  setPlayfieldBit(roomData, (cx, ypos) => {
    if (
      hitTestRects(x - 4, y - 4, 8, 8, cx * cell_width, ypos * cell_height, cell_width, cell_height)
    ) {
      hitWall = true;
      return true;
    }

    if (mirror) {
      if (
        hitTestRects(
          x - 4,
          y - 4,
          8,
          8,
          (cx + 20) * cell_width,
          ypos * cell_height,
          cell_width,
          cell_height,
        )
      ) {
        hitWall = true;
        return true;
      }
    } else {
      if (
        hitTestRects(
          x - 4,
          y - 4,
          8,
          8,
          (40 - (cx + 1)) * cell_width,
          ypos * cell_height,
          cell_width,
          cell_height,
        )
      ) {
        hitWall = true;
        return true;
      }
    }
  });

  return hitWall;
}

function resolveCollisions(): void {
  if (!objectBall.hitX && !objectBall.hitY) {
    let hitObject = collisionCheckBallWithObjects(0);

    if (hitObject > ObjectId.None && hitObject == objectBall.linkedObject) {
      let diffX = objectBall.x - objectBall.previousX;

      objectBall.linkedObjectX += diffX / 2;

      let diffY = objectBall.y - objectBall.previousY;

      objectBall.linkedObjectY += diffY / 2;
    }
  }

  if (objectBall.hitX) {
    if (objectBall.hitObject > ObjectId.None && objectBall.hitObject == objectBall.linkedObject) {
      let diffX = objectBall.x - objectBall.previousX;
      objectBall.linkedObjectX += diffX / 2;
    }

    objectBall.x = objectBall.previousX;
    objectBall.hitX = false;
  }

  if (objectBall.hitY) {
    if (objectBall.hitObject > ObjectId.None && objectBall.hitObject == objectBall.linkedObject) {
      let diffY = objectBall.y - objectBall.previousY;
      objectBall.linkedObjectY += diffY / 2;
    }

    objectBall.y = objectBall.previousY;
    objectBall.hitY = false;
  }
}

function adjustRoomLevel(room: number): number {
  if (room & 0x80) {
    let newRoomIndex = (room & ~0x80) + gameLevel;

    room = roomLevelDiffs[newRoomIndex];
  }

  return room;
}

function hitTestRects(
  ax: number,
  ay: number,
  awidth: number,
  aheight: number,
  bx: number,
  by: number,
  bwidth: number,
  bheight: number,
): boolean {
  let intersects = true;

  if (ay - aheight >= by || ay <= by - bheight || ax + awidth <= bx || ax >= bx + bwidth) {
    intersects = false;
  }

  return intersects;
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
  let colorBackground: COLOR = colorTable[COLOR_LTGRAY];
  let color: COLOR =
    gameState === GameState.Win && winFlashTimer > 0
      ? getFlashColor()
      : colorTable[currentRoom.color];

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

  // Paint the surround under the playfield layer.
  if (objectSurround.room === objectBall.room && objectSurround.state === 0) {
    drawObject(objectSurround);
  }

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

  let x = (objectBall.x - 4) & ~0x00000001;
  let y = (objectBall.y - 10) & ~0x00000001;

  color = colorTable[roomDefs[displayedRoomIndex].color];
  paintPixel(color.r, color.g, color.b, x, y, 8, 8);

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

  objectSurround.displayed = false;

  let numDisplayed = 0;
  let i = displayedListIndex;

  while (numDisplayed++ < numAdded && numDisplayed <= MAX_DISPLAY_OBJECTS) {
    if (displayList[i] > ObjectId.None) {
      if (showObjectFlicker) {
        drawObject(objectDefs[displayList[i]]);
      }

      objectDefs[displayList[i]].displayed = true;
      colorLast = objectDefs[displayList[i]].color;
    } else if (displayList[i] === ObjectId.Surround) {
      objectSurround.displayed = true;
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

  if (objectSurround.room === room) {
    displayList[numAdded++] = ObjectId.Surround;
  }

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
