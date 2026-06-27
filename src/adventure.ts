import {
  paintPixel,
  playSound,
  random,
  readDifficultySwitches,
  readJoystick,
  readResetSwitch,
  readSelectSwitch,
  roomColor,
} from "./hardware";
import { Difficulty, GameState, ObjectId, Sound } from "./types";
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
import { dragonDiff, greenDragonMatrix, redDragonMatrix, yellowDragonMatrix } from "./data/dragons";

let switchReset: boolean;
let switchSelect: boolean;
let gameState: GameState = GameState.GameSelect;

// This is a state variable, holding the room that is currently
// being displayed. This is effectively always allowing an
// answer to the question: "Which room?"
let displayedRoomIndex: number = 0;

// This holds the persistent position that carries over between
// frames to implement the hardware multiplexer. This is always
// allowing an answer to: "Where are we in the cycle?"
let displayListCursor: number = 0;

let showObjectFlicker: boolean = true;
let flashColorHue: number = 0;
let flashColorLum: number = 0;
let gameLevel: number = 0;
let winFlashTimer: number = 0;
let flapTimer: number = 0;
let greenDragonTimer: number = 0;
let yellowDragonTimer: number = 0;
let redDragonTimer: number = 0;

// 0xff = steal immediately; counts up while the bat holds
// something, resets to 0 on pickup. The inverted sense
// (high value = hungry) mirrors the original ROM's timer
// logic.
let batFedUpTimer: number = 0xff;

// Per-frame entry point, called once per frame by the platform's
// animation loop. Reads switch state, edge-detects reset (fires
// on release, matching Atari 2600 hardware behavior), and routes
// to the appropriate tick function for the current game state.
// Switch states are saved at the end so the next frame's edge
// detectors can compare against them.
export function startGame(): void {
  const reset = readResetSwitch();
  const select = readSelectSwitch();

  // Edge-detect the reset switch: fires only on the transition
  // from pressed to released, matching the Atari 2600 hardware
  // behavior. The Win state ignores reset entirely.
  if (gameState !== GameState.Win && switchReset && !reset) {
    tickResetState();
  } else if (gameState === GameState.GameSelect) {
    tickSelectState(select);
  } else if (isGameActive()) {
    tickActiveGameState(select);
  } else if (gameState === GameState.Win) {
    tickWinState(reset, select);
  }

  // Save switch states so the edge detectors above can compare
  // against the next frame.
  switchReset = reset;
  switchSelect = select;

  advanceFlashColor();
}

// Runs each frame during active gameplay. Checks win condition and
// select-release exit first, then dispatches to one of the three
// sub-frames (Active1/2/3) that divide per-frame work across
// consecutive ticks, mirroring how the original 2600 ROM spread
// computation across TV scan lines to stay within its CPU budget.
function tickActiveGameState(select: boolean): void {
  if (objectDefs[ObjectId.Chalice].room === 0x12) {
    // Win condition: the chalice is returned to the yellow
    // castle (room 0x12).
    gameState = GameState.Win;
    winFlashTimer = 0xff;
    playSound(Sound.Won);
  } else if (switchSelect && !select) {
    // Select was released mid-game, which triggers a return to
    // the level selection screen.
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

    // Core level logic. The active game loop is spread across three
    // consecutive frames (Active1 → Active2 → Active3 → Active1),
    // mirroring how the original 2600 cartridge divided work across
    // television scan lines to stay within the CPU budget of a
    // single frame.
    if (gameState === GameState.Active1) {
      ballMovement();
      moveCarriedObject();
      printDisplay();
      ++gameState;
    } else if (gameState === GameState.Active2) {
      pickupPutdown();
      resolveCollisions();
      ++displayListCursor;
      surround();
      moveBat();
      portals();
      printDisplay();
      ++gameState;
    } else if (gameState === GameState.Active3) {
      moveGreenDragon();
      moveYellowDragon();
      moveRedDragon();
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

// Repositions the ball in the yellow castle and either performs a
// full level initialization (when coming from the selection screen)
// or revives all three dragons mid-game without disturbing object
// positions. A reset always transitions to Active1.
function tickResetState(): void {
  // Put the player in the initial yellow castle room.
  objectBall.room = 0x11;
  objectBall.x = 0x50 * 2;
  objectBall.y = 0x20 * 2;
  objectBall.previousX = objectBall.x;
  objectBall.previousY = objectBall.y;
  objectBall.linkedObject = ObjectId.None;

  displayedRoomIndex = objectBall.room;

  // Make the bat want to steal something immediately.
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

// Runs each frame while the level-selection screen is displayed.
// Advances gameLevel on select-release (cycling 0→1→2→0) and keeps
// the Number object's state in sync so that the displayed digit
// matches the chosen level.
function tickSelectState(select: boolean): void {
  objectDefs[ObjectId.Number].state = gameLevel;

  // Edge-detection: advance level only on select release.
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

// Runs each frame after the chalice reaches the yellow castle.
// Counts down winFlashTimer (which drives the room background
// flash in printDisplay) and exits back to level selection when
// either switch is released.
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

// Per-frame tick for the green dragon. Delegates to moveDragon
// with this dragon's behavior matrix and speed, threading the
// per-dragon timer as return value.
function moveGreenDragon(): void {
  greenDragonTimer = moveDragon(
    objectDefs[ObjectId.GreenDragon],
    greenDragonMatrix,
    2,
    greenDragonTimer,
  );
}

// Per-frame tick for the yellow dragon. Delegates to moveDragon
// with this dragon's behavior matrix and speed, threading the
// per-dragon timer as return value.
function moveYellowDragon(): void {
  yellowDragonTimer = moveDragon(
    objectDefs[ObjectId.YellowDragon],
    yellowDragonMatrix,
    2,
    yellowDragonTimer,
  );
}

// Per-frame tick for the red dragon. Delegates to moveDragon
// with this dragon's behavior matrix and speed, threading the
// per-dragon timer as return value.
function moveRedDragon(): void {
  redDragonTimer = moveDragon(objectDefs[ObjectId.RedDragon], redDragonMatrix, 3, redDragonTimer);
}

// Per-frame dragon state machine dispatcher. Routes to the handler
// for the current state (stalking, eating, roaring) and threads
// the timer through as mutable state. Dead dragons (state 1)
// require no per-frame work.
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
      playSound(Sound.Eaten);
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

    const { left } = readDifficultySwitches();
    timer = 0xfc - dragonDiff[gameLevel * 2 + (left === Difficulty.A ? 1 : 0)];

    dragon.x = objectBall.x / 2;
    dragon.y = objectBall.y / 2;
    dragon.movementX = 0;
    dragon.movementY = 0;

    playSound(Sound.Roar);
  }

  if (collisionCheckObjectWithObject(dragon, objectDefs[ObjectId.Sword])) {
    // If the sword hits the dragon, the dead state is transitioned to.
    dragon.state = 1;

    dragon.movementX = 0;
    dragon.movementY = 0;

    playSound(Sound.DragonDie);
  }

  if (dragon.state === 0) {
    dragonSeekFlee(dragon, matrix, speed);
  }

  return timer;
}

// Walks the dragon's behavior matrix one entry at a time, stopping
// at the first entry that produces a target. Difficulty B causes
// the dragon to flee the sword; difficulty A skips the flee entry
// and goes straight to seeking.
function dragonSeekFlee(dragon: OBJECT, matrix: number[], speed: number): void {
  const { right } = readDifficultySwitches();
  let i = right === Difficulty.B ? 0 : 2;

  do {
    const target = dragonComputeTarget(dragon, matrix[i + 0], matrix[i + 1]);

    if (target !== null) {
      dragonApplyMovement(dragon, target, speed);
      return;
    }
  } while (matrix[(i += 2)]);
}

// Dragon state machine:
//   0 = stalking (pursuing objects in its matrix, or fleeing the sword)
//   1 = dead
//   2 = eating (ball is captured; dragon holds it locked in place)
//   3 = roaring (brief countdown before the bite; the player can still escape)
// Resolves a single matrix entry into a seek/flee target for the dragon.
// Returns null if the entry's object is absent or not in the same room.
// seekDir: 1 = seeking (move toward), -1 = fleeing (move away).
function dragonComputeTarget(
  dragon: OBJECT,
  fleeObject: number,
  seekObject: number,
): { seekDir: number; seekX: number; seekY: number } | null {
  if (fleeObject > ObjectId.None && objectDefs[fleeObject] !== dragon) {
    const object = objectDefs[fleeObject];

    if (object.room === dragon.room) {
      return { seekDir: -1, seekX: object.x, seekY: object.y };
    }
  } else {
    if (seekObject === ObjectId.Ball && objectBall.room === dragon.room) {
      return { seekDir: 1, seekX: objectBall.x / 2, seekY: objectBall.y / 2 };
    }

    if (seekObject > ObjectId.None) {
      const object = objectDefs[seekObject];

      if (object.room === dragon.room) {
        return { seekDir: 1, seekX: object.x, seekY: object.y };
      }
    }
  }

  return null;
}

// Sets the dragon's X and Y movement deltas toward or away from a
// target position. seekDir (from dragonComputeTarget) flips the
// sign: +1 moves toward, -1 moves away. Movement is axis-aligned:
// x and y are set independently at the given speed. The vector is
// applied to the position later by moveGroundObject.
function dragonApplyMovement(
  dragon: OBJECT,
  target: { seekDir: number; seekX: number; seekY: number },
  speed: number,
): void {
  dragon.movementX = 0;
  dragon.movementY = 0;

  if (dragon.x < target.seekX) {
    dragon.movementX = target.seekDir * speed;
  } else if (dragon.x > target.seekX) {
    dragon.movementX = -(target.seekDir * speed);
  }

  if (dragon.y < target.seekY) {
    dragon.movementY = target.seekDir * speed;
  } else if (dragon.y > target.seekY) {
    dragon.movementY = -(target.seekDir * speed);
  }
}

// Attracts the first eligible object from magnetMatrix toward the
// magnet each frame, moving it one pixel per axis. Objects carried
// by the player are skipped. The vertical target is offset by the
// magnet's height so attracted objects stack against its bottom
// edge rather than its center. Only one object is attracted per
// frame.
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

// Drives bat behavior each frame: updates the wing animation, then
// increments batFedUpTimer while carrying something, and triggers
// batSeekAndPickUp once the timer reaches 0xFF. The timer acts as
// a patience counter in that the bat holds an object for a fixed
// duration before seeking to swap it for something else.
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
    // Enlarge the bat extent by 7 pixels for proximity checks. The
    // idea is that expanding the bat once is faster than expanding
    // each candidate object.
    const batExtent = calcPlayerSpriteExtents(bat);

    batExtent.x -= 7;
    batExtent.y -= 7;
    batExtent.w += 7 * 2;
    batExtent.h += 7 * 2;

    batSeekAndPickUp(bat, batExtent);
  }
}

// Walks batMatrix to find the first object in the same room as the
// bat that it is not already carrying, steers toward it, and picks
// it up on contact, stealing it from the player if necessary. Only
// the first eligible matrix entry is acted on; later entries are
// ignored until the next seek cycle.
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

// Returns the bat's movement delta on a single axis toward a seek
// target: +3 if behind, -3 if ahead, 0 if aligned. This is applied
// independently to X and Y.
function batComputeAxisMovement(batPos: number, seekPos: number): number {
  if (batPos < seekPos) {
    return 3;
  }

  if (batPos > seekPos) {
    return -3;
  }

  return 0;
}

// Toggles the bat between its two wing states (folded/open) every
// 4 frames, producing the flapping animation.
function batUpdateFlap(bat: OBJECT): void {
  if (++flapTimer >= 0x04) {
    bat.state = bat.state === 0 ? 1 : 0;
    flapTimer = 0;
  }
}

// Returns true when the ball is within the bridge's passable zone,
// which suppresses wall collision so the player can walk through
// playfield walls at that position. The bridge cannot be used as a
// passage while it is being carried (linkedObject check). x and y
// are in ball coordinate space; x/2 converts to object coordinate
// space for comparison against bridge.x and bridge.y.
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

// Handles the fire button: drops the currently carried object if
// one is held, or scans for a touchable object to pick up. The
// scan starts at ObjectId.Sword to skip non-carryable objects
// (portcullises, Name, Number). If the first hit is the
// already-carried object, the scan resumes from the next index
// to find another.
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

// Keeps the carried object's position locked to the ball by
// applying the stored XY offset, then calls moveGroundObject,
// mirroring the original ROM where ground-object movement was
// handled in the same subroutine as the carried-object update.
function moveCarriedObject(): void {
  if (objectBall.linkedObject >= 0) {
    let object: OBJECT = objectDefs[objectBall.linkedObject];

    object.x = objectBall.x / 2 + objectBall.linkedObjectX;
    object.y = objectBall.y / 2 + objectBall.linkedObjectY;
    object.room = objectBall.room;
  }

  moveGroundObject();
}

// Drives all autonomous object movement for one frame: checks
// portal entry for the ball, then advances every object from
// RedDragon onward by its movement vector and then calls
// moveGroundObjectAcrossRooms for room transitions. This also
// propagates position to any object being carried (linked) by
// a moving object.
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

// Checks all four edges and transitions the object to the adjacent
// room when it crosses a boundary. Bottom-edge transitions are
// delegated to groundObjectHandleDownWrap because castle entry
// rooms need special handling on that axis only.
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

// Handles a ground object crossing the bottom edge of a room.
// Objects in a castle entry room are redirected into the
// corresponding castle interior; all others transition normally
// to roomDown.
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

// Ticks all three portcullises against their matching keys each
// frame. Each runs independently; see tickPortal for the state
// machine.
function portals(): void {
  tickPortal(ObjectId.Port1, objectDefs[ObjectId.Port1], objectDefs[ObjectId.YellowKey]);
  tickPortal(ObjectId.Port2, objectDefs[ObjectId.Port2], objectDefs[ObjectId.WhiteKey]);
  tickPortal(ObjectId.Port3, objectDefs[ObjectId.Port3], objectDefs[ObjectId.BlackKey]);
}

// Tests whether the ball is touching a portcullis that is not fully
// closed (state 0x0C). If so, moves the ball into the castle entry
// room and resets the portcullis to open so the player can exit
// again. Returns true so moveGroundObject can stop checking further
// portals once a match is found.
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

// Positions the surround object beneath the ball when in a gray
// (maze) room. The surround is an oversized sprite that fills the
// playfield area, preventing the ball's color from bleeding into
// wall cells. In non-gray rooms it is hidden by moving it to
// room -1.
function surround(): void {
  // Get the playfield data.
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

// Returns true if any dragon is currently holding the ball (player
// is captured). Used to suppress ball movement and collision while
// eaten.
function ballIsEaten(): boolean {
  return (
    objectDefs[ObjectId.YellowDragon].linkedObject === ObjectId.Ball ||
    objectDefs[ObjectId.GreenDragon].linkedObject === ObjectId.Ball ||
    objectDefs[ObjectId.RedDragon].linkedObject === ObjectId.Ball
  );
}

// Reads joystick input and moves the ball, then checks room
// transitions and collisions on each axis independently. Here
// tempX and tempY capture positions before each axis moves so
// the collision checks can test the previous perpendicular
// position (isolating which axis caused a hit). When eaten by
// a dragon, movement input is still read but room-wrap and
// collision are suppressed: hitX and hitY are forced true to
// keep the ball locked in place.
function ballMovement(): void {
  const tempX = objectBall.x;
  const tempY = objectBall.y;

  const eaten: boolean = ballIsEaten();

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

// Teleports the ball to the fixed spawn point inside a castle when
// the player walks through the bottom of a castle entry room. The
// portId selects which castle; the destination room is resolved
// through adjustRoomLevel to handle level-dependent castle layouts.
function ballEnterCastle(portId: number): void {
  objectBall.x = 0xa0;
  objectBall.y = 0x2c * 2;
  objectBall.previousX = objectBall.x;
  objectBall.previousY = objectBall.y;
  objectBall.room = adjustRoomLevel(castleRoomOffsets[portId]);
}

// Handles the ball crossing the left or right edge of a room.
// Room 0x3 (Left of Name) has a hardcoded right-exit to room 0x1E
// (the easter egg name room) which is not reachable through the
// normal room connection map.
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

// Handles the ball crossing the top or bottom edge of a room.
// Moving off the top transitions to roomUp. Moving off the
// bottom normally transitions to roomDown, but the three castle
// entry rooms instead teleport the ball inside via ballEnterCastle.
// Before committing a bottom transition, the destination room is
// collision-tested at the new Y; if blocked, hitY is set and the
// room stays the same. tempX is the ball's previous X position,
// used for that destination collision test.
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

// Tests whether the ball's new X position causes a collision. Here
// tempY is the ball's previous Y position, tested at (newX, tempY)
// to isolate whether the X movement specifically caused the hit.
// Unlike the Y check there is no bridge exception here; the bridge
// only suppresses wall collision on the vertical axis.
function ballCheckXCollision(tempY: number): void {
  const hitObject = collisionCheckBallWithObjects(0);
  const hitWall = collisionCheckBallWithWalls(objectBall.room, objectBall.x, tempY);

  if (hitWall || hitObject > ObjectId.None) {
    objectBall.hitX = true;
    objectBall.hitObject = hitObject;
  }
}

// Tests whether the ball's new Y position causes a collision. Here
// tempX is the ball's previous X position, tested at (tempX, newY)
// to isolate whether the Y movement specifically caused the hit.
// Wall collision is suppressed when the ball is crossing the
// bridge, allowing passage through playfield walls at that
// location.
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

// Tests an object's sprite blocks against an arbitrary rectangle.
// On the original hardware this was handled by TIA Player/Missile
// collision registers; here it is done explicitly per 2×2 block.
// Follows the same data traversal as drawObject: advance to the
// active animation frame, then scan rows upward (where objectY
// decreases), testing each set bit MSB-first against the target
// rect. x-wrapping is applied to blocks near the right edge,
// matching drawObject's rendering behavior.
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

// Scans objectDefs from startIndex for the first object that
// overlaps the ball, returning its index or ObjectId.None. The
// startIndex lets callers skip non-carryable objects (pass
// ObjectId.Sword to start at the first pickup-eligible object) or
// resume past a known hit (pass hitIndex + 1) to find a second
// overlapping object. Only objects with displayed == true are
// tested, which matches the original hardware where only rendered
// sprites could trigger TIA collision registers.
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

// Collision check two objects at the pixel level. On the 2600, this
// is done in hardware by the Player/Missile collision registers.
//
// There is a four-level nested scan here:
//   (obj1 rows → obj1 bits → obj2 rows → obj2 bits)
// That is a direct translation of per-pixel hardware collision and
// cannot be split further without either returning mutable Y-state
// across calls or altering the original's behavior: objectY2
// intentionally does not reset between bit1 iterations within a
// row.
//
// What this enables is pixel-accurate collision test between two
// game objects and how that plays out is primarily with dragon/bat
// interactions: detecting when a dragon touches the sword, or when
// the bat overlaps a carriable object. There's two-phases: a
// bounding box rejection first to avoid the expensive per-block
// test, then a block-by-block overlap check that accounts for
// x-wrapping on objects positioned near the screen edges.
export function collisionCheckObjectWithObject(object1: OBJECT, object2: OBJECT): boolean {
  // Trivial rejection: this is a guard for different rooms or for
  // non-overlapping bounding boxes.
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

  // Object extents overlap: go pixel by pixel.
  const objectX1 = object1.x - CLOCKS_HSYNC;
  let objectY1 = object1.y;
  const objectSize1 = object1.size / 2 + 1;

  const objectX2 = object2.x - CLOCKS_HSYNC;
  let objectY2 = object2.y;
  const objectSize2 = object2.size / 2 + 1;

  const s1 = advanceToState(object1.graphicsData!, object1.states[object1.state]);
  const s2 = advanceToState(object2.graphicsData!, object2.states[object2.state]);

  for (let i = 0; i < s1.height; i++) {
    // Parse the object1 row. Each bit is a 2×2 block.
    const rowByte1 = object1.graphicsData![s1.index + i];

    for (let bit1 = 0; bit1 < 8; bit1++) {
      if (rowByte1 & (1 << (7 - bit1))) {
        // Test this pixel of object1 against every pixel of object2.
        let i2 = s2.index;

        for (let j = 0; j < s2.height; j++) {
          // Parse the object2 row. Each bit is a 2×2 block.
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

// Tests the ball against all wall geometry in the room: thin wall
// barriers first, then every set bit in the playfield bitmask.
// Both the left half and the mirrored or repeated right half are
// checked. Returns true on the first hit found.
function collisionCheckBallWithWalls(room: number, x: number, y: number): boolean {
  let hitWall = false;

  // Playfield graphics are drawn offset into the overscan area;
  // shift y to match.
  y -= 30;

  // Get the playfield data.
  const currentRoom: ROOM = roomDefs[room];
  const roomData = currentRoom.graphicsData;

  // Get the playfield mirror flag.
  const mirror = currentRoom.flags & ROOMFLAG_MIRROR;

  // Each cell is 8 x 32.
  const cell_width = 8;
  const cell_height = 32;

  if (currentRoom.flags & ROOMFLAG_LEFTTHINWALL && x - (4 + 4) < 0x0d * 2) {
    hitWall = true;
  }

  if (currentRoom.flags & ROOMFLAG_RIGHTTHINWALL && x + 4 > 0x96 * 2) {
    // If the dot is in this room, allow passage through the wall
    // into the Easter Egg room.
    if (objectDefs[ObjectId.Dot].room !== room) {
      hitWall = true;
    }
  }

  // Check each bit of the playfield data to see if they intersect
  // the ball.
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

// Applies collision results that are set by two core functions:
// ballCheckXCollision and ballCheckYCollision. Each axis is handled
// independently: if a hit was recorded, the ball is pushed back to
// its previous position on that axis. When the ball is carrying an
// object, the carried object's offset is adjusted by the same delta
// so it stays in the player's hand rather than teleporting. The
// no-hit branch also runs a carry check to keep a held object from
// drifting out of alignment when no wall was struck.
function resolveCollisions(): void {
  if (!objectBall.hitX && !objectBall.hitY) {
    // Make sure stuff the player is carrying stays out of the way.
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

// Resolves a room connection that may be level-dependent. Most
// room exits are fixed room numbers, but exits with bit 7 set are
// indirect: the lower 7 bits are a base index into roomLevelDiffs,
// and adding gameLevel (0, 1, or 2) selects the actual destination
// for the current difficulty. Fixed exits pass through unchanged.
function adjustRoomLevel(room: number): number {
  if (room & 0x80) {
    let newRoomIndex = (room & ~0x80) + gameLevel;

    room = roomLevelDiffs[newRoomIndex];
  }

  return room;
}

// Advances through a sprite's packed data to find the start index
// and row height for a given animation state. Each state is stored
// sequentially: one height byte followed by that many row bytes.
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

// Folds an x coordinate that has gone past the right edge back to
// the left side, matching the screen-wrap behavior applied in
// drawObject and collisionCheckObject.
function wrapScreenX(x: number): number {
  return x >= SCREEN_WIDTH ? x - SCREEN_WIDTH : x;
}

// Computes the axis-aligned bounding box of an object in screen
// coordinates for use in broad-phase collision rejection. Width
// spans all 8 columns at the object's size scale; height is the
// active frame's row count doubled (using game→screen coordinate
// conversion). CLOCKS_HSYNC is subtracted from x to convert from
// beam-clock space to screen pixel space, matching the adjustment
// made in drawObject.
export function calcPlayerSpriteExtents(object: OBJECT): EXTENT {
  // Calculate the object's size and position.
  let cx = object.x * 2;
  let cy = object.y * 2;
  let size = object.size / 2 + 1;
  let cw = 8 * 2 * size;

  // Look up the index to the current state for this object.
  let stateIndex = object.states[object.state];

  // Get the height, then the data (the first byte of the data
  // is the height).
  const dataP = object.graphicsData!;
  let i = 0;
  let ch = dataP[i++];

  // Index into the proper state, making sure to skip over the
  // data.
  for (let x = 0; x < stateIndex; x++) {
    i += ch;
    ch = dataP[i++];
  }

  ch *= 2;

  // Adjust for proper position.
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

// Initializes all game objects for the selected difficulty. Clears
// movement and links for every object, then applies the starting
// positions from the level table (game1Objects for level 1 and
// game2Objects for levels 2 and 3). Level 3 additionally randomizes
// each object's room within the bounds defined in roomBoundsData.
function setupRoomObjects(): void {
  // First, initialize all game objects.
  for (let i = 0; objectDefs[i].graphicsData; i++) {
    let object: OBJECT = objectDefs[i];

    object.movementX = 0;
    object.movementY = 0;
    object.linkedObject = ObjectId.None;
  }

  // Second, read the object initialization table for the current
  // game level.
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

  // Put objects in random rooms for level 3.
  if (gameLevel === 2) {
    const boundsData: number[] = roomBoundsData;

    let i = 0;
    let object = boundsData[i++];
    let lower = boundsData[i++];
    let upper = boundsData[i++];

    do {
      // Pick a room between upper and lower bounds (inclusive).
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

// Convenience predicate used by startGame to route ticks away from
// the GameSelect and Win states without enumerating every Active
// sub-state explicitly.
function isGameActive(): boolean {
  return (
    gameState === GameState.Active1 ||
    gameState === GameState.Active2 ||
    gameState === GameState.Active3
  );
}

// Renders a complete frame. This means a lot of things. It clears
// the background, draws the surround object if active, paints all
// playfield cells for the displayed room, draws the ball, then
// draws all objects via the multiplex loop. The displayedRoomIndex
// may differ from objectBall.room during room transitions, which
// allows the incoming room to be shown before the ball's room
// field updates.
function printDisplay(): void {
  // First, get the playfield data.
  let displayedRoom = displayedRoomIndex;
  const currentRoom: ROOM = roomDefs[displayedRoom];
  const roomData = currentRoom.graphicsData;

  // Win condition flashes the entire room background until the
  // winFlashTimer expires. Uses the same getFlashColor() as
  // COLOR_FLASH objects, but applied to the room rather than to
  // a specific object.
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

  // Get the playfield mirror flag.
  let mirror = currentRoom.flags & ROOMFLAG_MIRROR;

  // Each cell is 8 x 32 and this is what draws the actual
  // playfield.
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

  // This is where the ball object is drawn.
  let x = (objectBall.x - 4) & ~0x00000001;
  let y = (objectBall.y - 10) & ~0x00000001;

  color = colorTable[roomDefs[displayedRoomIndex].color];
  paintPixel(color.r, color.g, color.b, x, y, 8, 8);

  // Finally, any objects in the room can be drawn.
  drawObjects(displayedRoom);
}

// The frame's actual render pass. Owns the multiplex loop that
// cycles displayListCursor across more objects than the hardware
// could display simultaneously, updates the displayed flag that
// collision detection reads, and conditionally draws each object.
// colorLast mutates as objects are drawn and is consumed by
// drawThinWalls afterward to color the thin wall missile sprites.
// That shared mutable state is why the loop body resists further
// extraction.
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

  // The multiplexer cycles through at most maxDisplayableObjects
  // objects per frame, mirroring the Atari 2600's 2-sprite hardware
  // limit. When more objects are in the room than the hardware
  // could show, each gets drawn only on some frames, which leads to
  // the characteristic flicker of the original game. The displayed
  // flag is updated here regardless of showObjectFlicker because
  // collision detection depends on it; skipping this loop when
  // flicker is off would silently break the pickup and enemy
  // interactions.
  let numDisplayed = 0;
  let i = displayListCursor;

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

  // With flicker off, the multiplexer loop above still ran to keep
  // displayed flags accurate, but only drew up to maxDisplayableObjects
  // objects. This pass draws everything in the room unconditionally,
  // which is a quality-of-life departure from the original hardware
  // that keeps all objects visible at the cost of authenticity.
  if (!showObjectFlicker) {
    for (let i = 0; objectDefs[i].graphicsData; i++) {
      if (objectDefs[i].room === room) {
        drawObject(objectDefs[i]);
      }
    }
  }

  drawThinWalls(room, colorFirst, colorLast);
}

// Renders a single object to the canvas at its current position
// and state. The graphics data format is important here. The
// graphicsData is a packed array of animation frames. Each frame
// begins with a height byte (row count), followed by one byte per
// row where each set bit represents a 2×2 pixel block (and where
// MSB = leftmost). object.states[object.state] gives the number of
// frames to skip over in graphicsData to reach the active frame,
// allowing multiple states to share a frame. A non-zero size field
// scales each block proportionally.
function drawObject(object: OBJECT): void {
  // COLOR_FLASH is a sentinel: resolve it to a live cycling color
  // rather than a fixed table entry. Called every frame so the
  // color advances with each draw.
  let color: COLOR = object.color === COLOR_FLASH ? getFlashColor() : colorTable[object.color];

  // Game coordinates are in half-pixel units; multiply by 2 to get
  // screen pixels.
  let cx = object.x * 2;
  let cy = object.y * 2;

  // The ROM's size field is 0-based in half-unit steps; convert to
  // a pixel multiplier so that size 0 → 1×1 blocks, size 2 → 2×2
  // blocks, and so on.
  let size = object.size / 2 + 1;

  // stateIndex is the number of animation frames to skip in the
  // graphicsData to reach the frame for the current state. The
  // object.state selects which state (e.g. gate open vs. closed);
  // object.states[] maps that to a frame offset in the packed data
  // array.
  let stateIndex = object.states[object.state];

  // dataP is a local alias that lets the non-null assertion be
  // applied once rather than on every index. i is a byte cursor
  // into the packed array. The first byte at i=0 is the frame
  // height (row count); i++ reads it and advances the cursor past
  // it so the next read lands on the first row's pixel data.
  const dataP = object.graphicsData!;
  let i = 0;
  let objHeight = dataP[i++];

  // Each frame in graphicsData is [heightByte, row0, row1, ..., rowN-1].
  // To reach the target frame, skip stateIndex complete frames:
  // advance i by the current frame's row count, then read the
  // next height byte and repeat.
  for (let x = 0; x < stateIndex; x++) {
    i += objHeight;
    objHeight = dataP[i++];
  }

  // Object coordinates include the TIA beam-clock sync offsets (the
  // period before the visible scanline begins). Subtracting them
  // converts to screen pixel coordinates.
  cx -= CLOCKS_HSYNC;
  cy -= CLOCKS_VSYNC;

  // Each row byte is MSB-first: bit 7 is the leftmost block, bit 0
  // is the rightmost. The (7-bit) inversion maps loop index 0 → leftmost
  // column. Each set bit paints a block of 2*size × 2 pixels.
  // x-wrapping handles objects positioned past the right edge, which
  // the original hardware allowed. Rows are drawn upward (cy decreases)
  // because the data is stored with the bottom row first, matching
  // Atari conventions.
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
    displayListCursor = 0;
  } else {
    if (displayListCursor > numAdded) {
      displayListCursor = 0;
    }

    if (displayListCursor > MAX_OBJECTS) {
      displayListCursor = 0;
    }

    if (displayList[displayListCursor] === ObjectId.None) {
      displayListCursor = 0;
    }
  }
}

// Separates the "scan what's in this room" step from the draw loop
// so the multiplexer cursor (displayListCursor) can be validated
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
