// Game logic.

import {
  paintPixel,
  playSound,
  random,
  readJoystick,
  readResetSwitch,
  readSelectSwitch,
  roomColor,
} from "./hardware";
import { GameState, ObjectId, Sound } from "./types";
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
import type { EXTENT, OBJECT, ROOM } from "./types";
import {
  CLOCKS_HSYNC,
  CLOCKS_VSYNC,
  MAX_DISPLAY_OBJECTS,
  MAX_OBJECTS,
  OVERSCAN,
  PLAYFIELD_COLS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  TOTAL_HEIGHT,
} from "./constants";
import { game1Objects, game2Objects, objectBall, objectDefs, objectSurround } from "./data/objects";
import { joystick } from "./data/action";
import { batMatrix } from "./data/bats";
import { magnetMatrix } from "./data/magnets";
import { greenDragonMatrix } from "./data/dragons";

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
let flapTimer: number = 0;
let batFedUpTimer: number = 0xff;
let greenDragonTimer = 0;

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

  advanceFlashColor();
}

function tickActiveGameState(select: boolean): void {
  if (objectDefs[ObjectId.Chalice].room === 0x12) {
    // Win condition: the chalice is returned to the yellow
    // castle (room 0x12).
    gameState = GameState.Win;
    winFlashTimer = 0xff;
    playSound(Sound.Won);
  } else if (switchSelect && !select) {
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
      moveCarriedObject();
      printDisplay();
      ++gameState;
    } else if (gameState === GameState.Active2) {
      pickupPutdown();
      resolveCollisions();
      ++displayedListIndex;
      surround();
      moveBat();
      portals();
      printDisplay();
      ++gameState;
    } else if (gameState === GameState.Active3) {
      moveGreenDragon();
      magnet();
      printDisplay();
      gameState = GameState.Active1;
    }
  }
}

// Portcullis state machine (each port runs independently):
//   0      = open (unlocked); key contact starts the closing animation
//   1–11   = closing animation (state increments each frame)
//   12     = closed (locked); key contact starts the opening animation
//   13–22  = opening animation (state increments each frame)
//   >22    = resets to 0 (open) and restores the exit room connection
function tickPortal(portId: number, port: OBJECT, key: OBJECT): void {
  if (
    port.room === objectBall.room &&
    key.room === objectBall.room &&
    (port.state === 0 || port.state === 12)
  ) {
    if (collisionCheckObjectWithObject(port, key)) {
      port.state++;
    }
  }

  if (port.state !== 0 && port.state !== 12) {
    port.state++;
  }

  if (port.state > 22) {
    port.state = 0;
    roomDefs[entryRoomOffsets[portId]].roomDown = castleRoomOffsets[portId];
  } else if (port.state === 12) {
    roomDefs[entryRoomOffsets[portId]].roomDown = entryRoomOffsets[portId];
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
  batFedUpTimer = 0xff;

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

function moveGreenDragon(): void {
  greenDragonTimer = moveDragon(
    objectDefs[ObjectId.GreenDragon],
    greenDragonMatrix,
    2,
    greenDragonTimer,
  );
}

function moveDragon(dragon: OBJECT, matrix: number[], speed: number, timer: number): number {
  if (dragon.state === 0) {
    timer = dragonHandleAlive(dragon, matrix, speed, timer);
  } else if (dragon.state === 1) {
    // Dragon is dead. Do nothing.
  } else if (dragon.state === 2) {
    dragonHandleEaten(dragon);
  } else if (dragon.state === 3) {
    timer = dragonHandleRoar(dragon, timer);
  }

  return timer;
}

function dragonHandleRoar(dragon: OBJECT, timer: number): number {
  --timer;

  if (timer <= 0) {
    // If the dragon has roared, transition to the eaten state.
    if (
      objectBall.room === dragon.room &&
      collisionCheckObject(dragon, objectBall.x - 4, objectBall.y - 1, 8, 8)
    ) {
      dragon.linkedObject = ObjectId.Ball;
      dragon.state = 2;
    } else {
      dragon.state = 0;
    }
  }

  return timer;
}

function dragonHandleEaten(dragon: OBJECT): void {
  objectBall.room = dragon.room;
  objectBall.x = (dragon.x + 3) * 2;
  objectBall.y = (dragon.y - 10) * 2;

  dragon.movementX = 0;
  dragon.movementY = 0;

  displayedRoomIndex = objectBall.room;
}

function dragonHandleAlive(dragon: OBJECT, matrix: number[], speed: number, timer: number): number {
  if (
    objectBall.room === dragon.room &&
    collisionCheckObject(dragon, objectBall.x - 4, objectBall.y - 4, 8, 8)
  ) {
    // If the ball hits the dragon, the roar state is transitioned to.
    dragon.state = 3;

    dragon.x = objectBall.x / 2;
    dragon.y = objectBall.y / 2;
    dragon.movementX = 0;
    dragon.movementY = 0;
  }

  if (collisionCheckObjectWithObject(dragon, objectDefs[ObjectId.Sword])) {
    // If the sword hits the dragon, the dead state is transitioned to.
    dragon.state = 1;

    dragon.movementX = 0;
    dragon.movementY = 0;
  }

  if (dragon.state === 0) {
    dragonSeekFlee(dragon, matrix, speed);
  }

  return timer;
}

function dragonSeekFlee(dragon: OBJECT, matrix: number[], speed: number): void {
  console.log(dragon);
  console.log(matrix);
  console.log(speed);
}

function magnet(): void {
  const magnet: OBJECT = objectDefs[ObjectId.Magnet];
  let i = 0;

  while (magnetMatrix[i]) {
    // Look for items in the magnet matrix that are in the same
    // room as the magnet.
    let object: OBJECT = objectDefs[magnetMatrix[i]];

    if (magnetMatrix[i] !== objectBall.linkedObject && object.room === magnet.room) {
      // Handle the horizontal and vertical axis. The vertical is
      // offset by the height of the magnet so that items stick
      // to the "bottom."
      if (object.x < magnet.x) {
        object.x++;
      } else if (object.x > magnet.x) {
        object.x--;
      }

      if (object.y < magnet.y - magnet.graphicsData![0]) {
        object.y++;
      } else if (object.y > magnet.y - magnet.graphicsData![0]) {
        object.y--;
      }

      // Break the loop so that only the first item found in
      // the matrix is attracted.
      break;
    }

    ++i;
  }
}

function moveBat(): void {
  const bat: OBJECT = objectDefs[ObjectId.Bat];

  batUpdateFlap(bat);

  // The bat "fed up" timer is set so that 0xff means the bat steals
  // immediately. This counts up while the bat holds something, and
  // resets to 0 on pickup. The inverted sense (high value = hungry)
  // mirrors the original ROM's timer logic.
  if (bat.linkedObject !== ObjectId.None && batFedUpTimer < 0xff) {
    ++batFedUpTimer;
  }

  if (batFedUpTimer >= 0xff) {
    const batExtent = calcPlayerSpriteExtents(bat);

    batExtent.x -= 7;
    batExtent.y -= 7;
    batExtent.w += 7 * 2;
    batExtent.h += 7 * 2;

    batSeekAndPickUp(bat, batExtent);
  }
}

function batSeekAndPickUp(bat: OBJECT, batExtent: EXTENT): void {
  let i = 0;

  do {
    const seekObject = objectDefs[batMatrix[i]];

    if (seekObject.room === bat.room && bat.linkedObject !== batMatrix[i]) {
      bat.movementX = batComputeAxisMovement(bat.x, seekObject.x);
      bat.movementY = batComputeAxisMovement(bat.y, seekObject.y);

      const objExtent = calcPlayerSpriteExtents(seekObject);

      if (
        hitTestRects(
          batExtent.x,
          batExtent.y,
          batExtent.w,
          batExtent.h,
          objExtent.x,
          objExtent.y,
          objExtent.w,
          objExtent.h,
        )
      ) {
        if (batMatrix[i] === objectBall.linkedObject) {
          objectBall.linkedObject = ObjectId.None;
        }

        bat.linkedObject = batMatrix[i];
        bat.linkedObjectX = 8;
        bat.linkedObjectY = 0;
        batFedUpTimer = 0;
      }
      break;
    }
  } while (batMatrix[++i]);
}

function batComputeAxisMovement(batPos: number, seekPos: number): number {
  if (batPos < seekPos) {
    return 3;
  }

  if (batPos > seekPos) {
    return -3;
  }

  return 0;
}

function batUpdateFlap(bat: OBJECT): void {
  if (++flapTimer >= 0x04) {
    bat.state = bat.state === 0 ? 1 : 0;
    flapTimer = 0;
  }
}

function crossingBridge(room: number, x: number, y: number): boolean {
  const bridge: OBJECT = objectDefs[ObjectId.Bridge];

  if (bridge.room === room && objectBall.linkedObject !== ObjectId.Bridge) {
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
    playSound(Sound.PutDown);
  } else {
    // Determine if the player is touching any carryable object.
    let hitIndex = collisionCheckBallWithObjects(ObjectId.Sword);

    if (hitIndex > ObjectId.None) {
      // Ignore the object that is already being carried.
      if (hitIndex === objectBall.linkedObject) {
        // Check the remainder of the objects.
        hitIndex = collisionCheckBallWithObjects(hitIndex + 1);
      }

      if (hitIndex > ObjectId.None) {
        // Pick up the object.
        objectBall.linkedObject = hitIndex;

        // Calculate the XY offsets from the ball's position.
        objectBall.linkedObjectX = objectDefs[hitIndex].x - objectBall.x / 2;
        objectBall.linkedObjectY = objectDefs[hitIndex].y - objectBall.y / 2;

        playSound(Sound.PickUp);
      }
    }
  }
}

function moveCarriedObject(): void {
  if (objectBall.linkedObject >= 0) {
    let object: OBJECT = objectDefs[objectBall.linkedObject];

    object.x = objectBall.x / 2 + objectBall.linkedObjectX;
    object.y = objectBall.y / 2 + objectBall.linkedObjectY;
    object.room = objectBall.room;
  }

  // Called here to mirror the original 2600 ROM, which processed
  // the ground-object movement in the same subroutine as the
  // carried-object update.
  moveGroundObject();
}

function moveGroundObject(): void {
  // Handle ball going into the castles. The idea is to try each
  // portal in order, stopping at first match.
  for (const portId of [ObjectId.Port1, ObjectId.Port2, ObjectId.Port3]) {
    if (checkPortalEntry(portId, objectDefs[portId])) break;
  }

  // Move any objects that need moving, and wrap objects from room
  // to room.
  for (let i = ObjectId.RedDragon; objectDefs[i].graphicsData; i++) {
    const object: OBJECT = objectDefs[i];

    object.x += object.movementX;
    object.y += object.movementY;

    moveGroundObjectAcrossRooms(object);

    if (object.linkedObject > ObjectId.None) {
      const linkedObj: OBJECT = objectDefs[object.linkedObject];

      linkedObj.x = object.x + object.linkedObjectX;
      linkedObj.y = object.y + object.linkedObjectY;
      linkedObj.room = object.room;
    }
  }
}

function moveGroundObjectAcrossRooms(object: OBJECT): void {
  if (object.y > 0x6a) {
    object.y = 0x0d;
    object.room = adjustRoomLevel(roomDefs[object.room].roomUp);
  }

  if (object.x < 0x03) {
    object.x = 0x9a;
    object.room = adjustRoomLevel(roomDefs[object.room].roomLeft);
  }

  if (object.y < 0x0d) {
    groundObjectHandleDownWrap(object);
  }

  if (object.x > 0x9b) {
    object.x = 0x03;
    object.room = adjustRoomLevel(roomDefs[object.room].roomRight);
  }
}

function groundObjectHandleDownWrap(object: OBJECT): void {
  for (const portId of [ObjectId.Port1, ObjectId.Port2, ObjectId.Port3]) {
    if (object.room === entryRoomOffsets[portId]) {
      object.y = 0x5c;
      object.room = adjustRoomLevel(castleRoomOffsets[portId]);

      return;
    }
  }

  object.y = 0x69;
  object.room = adjustRoomLevel(roomDefs[object.room].roomDown);
}

function portals(): void {
  tickPortal(ObjectId.Port1, objectDefs[ObjectId.Port1], objectDefs[ObjectId.YellowKey]);
  tickPortal(ObjectId.Port2, objectDefs[ObjectId.Port2], objectDefs[ObjectId.WhiteKey]);
  tickPortal(ObjectId.Port3, objectDefs[ObjectId.Port3], objectDefs[ObjectId.BlackKey]);
}

function checkPortalEntry(portId: number, port: OBJECT): boolean {
  if (
    objectBall.room === port.room &&
    port.state !== 0x0c &&
    collisionCheckObject(port, objectBall.x - 4, objectBall.y - 1, 8, 8)
  ) {
    objectBall.room = entryRoomOffsets[portId];
    objectBall.y = OVERSCAN + OVERSCAN - 2;
    objectBall.previousY = objectBall.y;

    // This is important. The portal entry stays unlocked in case
    // the player walks in carrying the key.
    port.state = 0;

    return true;
  }

  return false;
}

function surround(): void {
  const currentRoom: ROOM = roomDefs[objectBall.room];

  if (currentRoom.color === COLOR_LTGRAY) {
    // Put the surround object in the same room as the ball and
    // center it under the ball.
    objectSurround.room = objectBall.room;
    objectSurround.x = (objectBall.x - 0x1e) / 2;
    objectSurround.y = (objectBall.y + 0x18) / 2;
  } else {
    objectSurround.room = -1;
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

function ballHandleXRoomWrap(): void {
  if (objectBall.x >= SCREEN_WIDTH - 4) {
    objectBall.x = 5;
    objectBall.room = objectBall.room === 0x3 ? 0x1e : roomDefs[objectBall.room].roomRight;
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
    if (objectBall.room === entryRoomOffsets[ObjectId.Port1]) {
      ballEnterCastle(ObjectId.Port1);
    } else if (objectBall.room === entryRoomOffsets[ObjectId.Port2]) {
      ballEnterCastle(ObjectId.Port2);
    } else if (objectBall.room === entryRoomOffsets[ObjectId.Port3]) {
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

    if (object.displayed && objectBall.room === object.room) {
      if (collisionCheckObject(object, objectBall.x - 4, objectBall.y - 1, 8, 8)) {
        return i;
      }
    }
  }

  return ObjectId.None;
}

export function collisionCheckObjectWithObject(object1: OBJECT, object2: OBJECT): boolean {
  if (object1.room !== object2.room) {
    return false;
  }

  const extent1 = calcPlayerSpriteExtents(object1);
  const extent2 = calcPlayerSpriteExtents(object2);

  if (
    !hitTestRects(
      extent1.x,
      extent1.y,
      extent1.w,
      extent1.h,
      extent2.x,
      extent2.y,
      extent2.w,
      extent2.h,
    )
  ) {
    return false;
  }

  const objectX1 = object1.x - CLOCKS_HSYNC;
  let objectY1 = object1.y;
  const objectSize1 = object1.size / 2 + 1;

  const objectX2 = object2.x - CLOCKS_HSYNC;
  let objectY2 = object2.y;
  const objectSize2 = object2.size / 2 + 1;

  const s1 = advanceToState(object1.graphicsData!, object1.states[object1.state]);
  const s2 = advanceToState(object2.graphicsData!, object2.states[object2.state]);

  for (let i = 0; i < s1.height; i++) {
    const rowByte1 = object1.graphicsData![s1.index + i];

    for (let bit1 = 0; bit1 < 8; bit1++) {
      if (rowByte1 & (1 << (7 - bit1))) {
        let i2 = s2.index;

        for (let j = 0; j < s2.height; j++) {
          const rowByte2 = object2.graphicsData![i2];

          for (let bit2 = 0; bit2 < 8; bit2++) {
            if (rowByte2 & (1 << (7 - bit2))) {
              const wrappedX1 = wrapScreenX(objectX1 + bit1 * 2 * objectSize1);
              const wrappedX2 = wrapScreenX(objectX2 + bit2 * 2 * objectSize2);

              if (
                hitTestRects(
                  wrappedX1,
                  objectY1,
                  2 * objectSize1,
                  2,
                  wrappedX2,
                  objectY2,
                  2 * objectSize2,
                  2,
                )
              ) {
                return true;
              }
            }
          }

          ++i2;
          objectY2 += 2;
        }
      }
    }

    objectY1 += 2;
  }

  return false;
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
    if (objectDefs[ObjectId.Dot].room !== room) {
      hitWall = true;
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
          (cx + PLAYFIELD_COLS) * cell_width,
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

    if (hitObject > ObjectId.None && hitObject === objectBall.linkedObject) {
      let diffX = objectBall.x - objectBall.previousX;

      objectBall.linkedObjectX += diffX / 2;

      let diffY = objectBall.y - objectBall.previousY;

      objectBall.linkedObjectY += diffY / 2;
    }
  }

  if (objectBall.hitX) {
    if (objectBall.hitObject > ObjectId.None && objectBall.hitObject === objectBall.linkedObject) {
      let diffX = objectBall.x - objectBall.previousX;
      objectBall.linkedObjectX += diffX / 2;
    }

    objectBall.x = objectBall.previousX;
    objectBall.hitX = false;
  }

  if (objectBall.hitY) {
    if (objectBall.hitObject > ObjectId.None && objectBall.hitObject === objectBall.linkedObject) {
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

function advanceToState(
  graphicsData: number[],
  stateIndex: number,
): { index: number; height: number } {
  let index = 0;
  let height = graphicsData[index++];

  for (let i = 0; i < stateIndex; i++) {
    index += height;
    height = graphicsData[index++];
  }

  return { index, height };
}

function wrapScreenX(x: number): number {
  return x >= SCREEN_WIDTH ? x - SCREEN_WIDTH : x;
}

export function calcPlayerSpriteExtents(object: OBJECT): EXTENT {
  let cx = object.x * 2;
  let cy = object.y * 2;
  let size = object.size / 2 + 1;
  let cw = 8 * 2 * size;
  let stateIndex = object.states[object.state];

  const dataP = object.graphicsData!;
  let i = 0;
  let ch = dataP[i++];

  for (let x = 0; x < stateIndex; x++) {
    i += ch;
    ch = dataP[i++];
  }

  ch *= 2;
  cx -= CLOCKS_HSYNC;

  return { x: cx, y: cy, w: cw, h: ch };
}

// This is an axis-aligned bounding box test. The y coordinates are
// bottom-edge origin (y is the top of the rect, y-height is the
// bottom), matching the Atari coordinate system where sprites are
// drawn upward from their specified position.
export function hitTestRects(
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

function setupRoomObjects(): void {
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
        let room = Math.floor(random()) * 0x1f;

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

function isGameActive(): boolean {
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
        (cx + PLAYFIELD_COLS) * cell_width,
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

function drawObject(object: OBJECT): void {
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

// Some rooms have thin vertical barriers that the playfield bitmask
// can't represent precisely enough. The original hardware used the
// missile sprites for these. This function paints them after the
// object pass so they layer correctly; if objects were drawn it
// inherits their colors (colorFirst for the left wall, colorLast
// for the right) to match the hardware's missile-sprite color
// behavior. If no objects were drawn, walls are black.
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

// The Atari 2600 could only render two sprites per frame. When a
// room holds more objects than that, the draw loop cycles through
// them across frames. This was the source of Adventure's
// characteristic flicker. The displayListIndex is the persistent
// cursor for that cycle; this function exists to establish a valid
// starting position before each frame's draw pass. If the room fits
// within the hardware limit there is nothing to cycle, so reset to
// 0. The three guards catch a stale index: it could be past the
// current room's object count (different room, smaller list), past
// MAX_OBJECTS, or at a None sentinel from a prior cycle that ran
// to the end of the list.
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

// Separates the "scan what's in this room" step from the draw loop
// so the multiplexer cursor (displayedListIndex) can be validated
// against actual room contents before cycling begins. Surround goes
// first because it must render beneath the playfield layer; draw
// order matters here. colorFirst and colorLast capture the colors
// of the first and last real objects: drawThinWalls uses them
// because missile sprites inherit color from the nearest rendered
// player sprite (an Atari hardware constraint). The value of the
// displayed member is reset here so that stale collisions state
//  from the previous frame is cleared before drawing starts.
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
//
// The three-way branch inside (pf0/pf1/pf2 selection by cx) is a
// direct expression of the Atari hardware encoding. Each register
// covers a distinct column range with its own bit ordering. There
// is no abstraction that makes this genuinely simpler: a lookup
// table carries the same decisions at init time and obscures the
// direct correspondence to the hardware spec.
export function setPlayfieldBit(
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

    for (let cx = 0; cx < PLAYFIELD_COLS; cx++) {
      let bit = false;

      if (cx < 4) bit = pf0 & shiftreg[cx] ? true : false;
      else if (cx < 12) bit = pf1 & shiftreg[cx] ? true : false;
      else bit = pf2 & shiftreg[cx] ? true : false;

      if (bit && callback(cx, ypos) === true) return;
    }
  }
}

// Advances the flash color state once per game tick. The hue
// cycles 360° in steps of 2, luminance pulses 0→200 in steps
// of 11 then resets. Called from startGame so that all of the
// COLOR_FLASH consumers see the same color value within a
// single frame.
function advanceFlashColor(): void {
  flashColorHue += 2;

  if (flashColorHue >= 360) {
    flashColorHue -= 360;
  }

  flashColorLum += 11;

  if (flashColorLum > 200) {
    flashColorLum = 0;
  }
}

// Generates a rainbow-shimmer color by cycling hue through three
// RGB segments (blue→red→green→blue) and independently pulsing
// luminance from 0 to 200. This is called every frame for the
// COLOR_FLASH objects and during the win screen. The hue and
// luminance are advanced by AdvanceFlashColor() once per game
// tick, not per call, so that all flash consumers see the same
// color within a single frame.
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
