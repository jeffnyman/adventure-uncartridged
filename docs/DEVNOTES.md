# Developer Notes

How the TypeScript codebase maps to the original 1979 Atari 2600 ROM: what was preserved, what was adapted, and where the hardware leaves its fingerprints in the modern code.

This is a companion to `ASSEMBLY.md`. Where that document explains the ROM, this one explains the port.

---

## Module Architecture

| Module            | Role                                          | Assembly analog                                 |
| ----------------- | --------------------------------------------- | ----------------------------------------------- |
| `hardware.ts`     | Platform abstraction layer                    | TIA &amp; RIOT hardware I/O                     |
| `adventure.ts`    | Game engine                                   | ROM `$F000–$FFFF`                               |
| `data/rooms.ts`   | Room layout and graphics                      | `RoomDataTable`, maze graphics blocks           |
| `data/objects.ts` | Object graphics and starting positions        | `GfxDrag0/1/2`, `Store1–Store9`, `Game1Objects` |
| `data/dragons.ts` | Dragon behavior matrices and difficulty table | `RedDragMatrix`, `YelDragMatrix`, `DragonDiff`  |
| `data/bats.ts`    | Bat attraction matrix                         | `BatMatrix`                                     |
| `data/magnets.ts` | Magnet attraction matrix                      | `MagnetMatrix`                                  |
| `types.ts`        | Shared interfaces and enums                   | Zero-page variable layout `$80–$FF`             |
| `constants.ts`    | Screen geometry and TIA sync offsets          | Hardcoded values embedded throughout the ROM    |

---

## hardware.ts — The Platform Abstraction Layer

The original ROM wrote directly to TIA and RIOT hardware registers. `hardware.ts` replaces that I/O surface with a thin JavaScript layer. Callers in `adventure.ts` never touch the DOM or `requestAnimationFrame` directly. Basically, the same interface the hardware provided, minus the actual hardware.

### The Y-Axis Flip

The Atari 2600 draws bottom-up: the electron gun starts at the bottom of the screen and sprite Y coordinates increase upward. The HTML canvas is top-down: Y=0 is the top-left, and coordinates increase downward. The transform applied at startup reconciles this at the call site rather than at every draw call:

```typescript
// Scale Y by −1 (flip axis), then translate by canvas.height
// to shift the flipped origin back into view.
ctx.transform(1, 0, 0, -1, 0, canvas.height);
```

Every `paintPixel` call in `adventure.ts` uses Atari Y coordinates directly with no per-call correction.

### Overscan

The real 2600 TV signal included 16 invisible scan lines above and below the visible frame, which was called the overscan region. The hardware included them in the total raster height, so game Y coordinates can fall in overscan territory. `paintPixel` subtracts `OVERSCAN` to shift the visible game world back into the canvas's renderable region:

```typescript
ctx.fillRect(x, y - OVERSCAN, width, height);
```

### Difficulty Switches

The 2600 had two physical difficulty switches (positions A and B) mounted on the console. `Difficulty.B` is the hardware default and remains the default here. The original ROM read switch state from RIOT I/O register `$282` every frame; `readDifficultySwitches()` provides the same interface:

```typescript
// Difficulty B (the amateur setting) was the hardware default on
// the original 2600. Dragons hesitate on left-B; run from sword on right-B.
let difficultyLeft: Difficulty = Difficulty.B;
let difficultyRight: Difficulty = Difficulty.B;
```

### Frame Rate

`FPS = 58` rather than the NTSC standard 60 matches the real 2600's actual display rate, which was nominally 60 Hz but in practice slightly lower due to the specific scan line counts in the ROM's display kernel at `$F008`. Using 58 produces timing behavior closer to the original cartridge.

---

## constants.ts — Screen Geometry

### TIA Sync Offsets

On the real hardware, the TIA positioned sprites relative to where the electron beam was at horizontal and vertical sync — not from the screen corner. Sprite coordinates were offset by those sync periods. These constants appear throughout `adventure.ts` as the correction that converts from beam-clock space to screen pixel space:

```typescript
export const CLOCKS_HSYNC = 2;
export const CLOCKS_VSYNC = 4;
```

Both are subtracted from object coordinates in `drawObject`, `collisionCheckObject`, and `collisionCheckObjectWithObject`. The same offsets are implicit in the ROM's `PosSpriteX` routine and `PrintDisplay` loop.

### Playfield Columns

```typescript
export const PLAYFIELD_COLS = 20;
```

The TIA playfield register is 20 bits wide, covering the left half of the screen. The right half is either mirrored or repeated from those same 20 bits — there are no separate right-half bits. `setPlayfieldBit` iterates all 20 columns and synthesizes the right half by mirroring (`cx + PLAYFIELD_COLS`) or flipping (`40 − (cx + 1)`) depending on the room's `ROOMFLAG_MIRROR` flag.

### Display Objects Limit

```typescript
export const MAX_DISPLAY_OBJECTS = 2;
```

The 2600 had two Player sprite registers. When a room held more than two objects, the ROM cycled which two were drawn each frame producing Adventure's characteristic flicker. `MAX_DISPLAY_OBJECTS = 2` preserves this hardware limit in the multiplexer.

---

## The Three-Subframe Game Loop

The ROM could not complete all per-frame logic within a single TV frame's worth of CPU time. It spread work across three consecutive frames, cycling through phases that collectively formed one logical game tick. This port preserves that structure directly as `GameState.Active1/2/3`:

| Subframe  | TypeScript functions                                                                   | Assembly phase                   |
| --------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| `Active1` | `ballMovement`, `moveCarriedObject`, `printDisplay`                                    | Ball movement + display kernel   |
| `Active2` | `pickupPutdown`, `resolveCollisions`, `surround`, `moveBat`, `portals`, `printDisplay` | Pickup/collision + bat + portals |
| `Active3` | `moveGreenDragon`, `moveYellowDragon`, `moveRedDragon`, `magnet`, `printDisplay`       | Dragon movement + magnet         |

`printDisplay()` runs at the end of every Active subframe: three screen refreshes per logical game cycle. This is a natural consequence of the hardware origin: the real ROM's display kernel ran every TV frame regardless of which game-logic phase was active.

---

## Rendering

### Sprite Data Format

Object graphics are stored as packed arrays. Multi-state objects concatenate all state frames sequentially. The format is:

```
[height, row0, row1, ... rowN-1,   // frame 0
 height, row0, row1, ...,          // frame 1
 ...]
```

Each row byte is MSB-first: bit 7 is the leftmost block, bit 0 the rightmost. Each set bit paints a `2×2` pixel block (scaled by `size` if non-zero). `object.states[object.state]` gives the number of complete frames to skip before reading the active frame. This is identical to the ROM's `GfxBat1/2`, `GfxDrag0/1/2`, and other graphics blocks.

Rows are drawn upward (`cy -= 2` per row) because the data is stored with the bottom row first, matching Atari conventions where sprites grow upward from their Y position.

### The Playfield Decoder: setPlayfieldBit

The TIA playfield register packs 20 bits into three bytes with non-obvious bit ordering:

- **PF0**: high nibble only (bits 4–7), read LSB→MSB
- **PF1**: all 8 bits, read MSB→LSB
- **PF2**: all 8 bits, read LSB→MSB

`setPlayfieldBit` encodes this directly in a shift-register lookup table and selects the register by column index:

```typescript
if (cx < 4) bit = pf0 & shiftreg[cx] ? true : false;
else if (cx < 12) bit = pf1 & shiftreg[cx] ? true : false;
else bit = pf2 & shiftreg[cx] ? true : false;
```

The three-way branch is a direct expression of the hardware encoding. There is no abstraction that makes it genuinely simpler — a lookup table would carry the same decisions at init time and lose the correspondence to the hardware spec.

### The Multiplexer and Flicker

The 2600 could render at most two sprites per frame. When more objects shared a room, the ROM displayed only two per frame and rotated which two, which produced a characteristic flicker. The `displayed` flag is updated regardless of `showObjectFlicker`:

```typescript
while (numDisplayed++ < numAdded && numDisplayed <= MAX_DISPLAY_OBJECTS) {
  if (showObjectFlicker) {
    drawObject(objectDefs[displayList[i]]);
  }
  // displayed must update even when flicker is off —
  // collision detection reads this flag.
  objectDefs[displayList[i]].displayed = true;
}
```

When `showObjectFlicker` is false, a second unconditional pass draws all room objects. Collision still uses only the first pass's `displayed` flags, which preserves the original behavior: an object that isn't rendered cannot collide.

### Thin Walls and Missile Sprite Color Inheritance

Some rooms have vertical barriers the 20-column playfield grid cannot represent precisely enough. The original hardware used Missile 0 and Missile 1 — two single-pixel-wide sprites — for these barriers. Missile sprites on the 2600 inherit their color from the last Player sprite written in the same scan line.

`drawThinWalls` reproduces this by threading `colorFirst` and `colorLast` (the colors of the first and last real objects drawn this frame) back from `buildRoomDisplayList`. The left wall takes `colorFirst`; the right takes `colorLast`. When no objects were drawn, both walls are black — the same fallback as an unloaded Missile sprite on the hardware.

---

## The Room System

### Room Data Format

Each room is a `ROOM` struct — a direct translation of the ROM's 9-byte `RoomDataTable` entries, with the graphics pointer made concrete as a typed array:

```typescript
interface ROOM {
  graphicsData: number[]; // 21 bytes: 7 rows × 3 (PF0, PF1, PF2)
  flags: number; // MIRROR | LEFTTHINWALL | RIGHTTHINWALL
  color: number; // index into colorTable
  roomUp: number;
  roomRight: number;
  roomDown: number;
  roomLeft: number;
}
```

### Level-Dependent Exits

Any room connection value with bit 7 set (`>= 0x80`) is an indirect reference. The lower 7 bits are a base index into `roomLevelDiffs`; adding `gameLevel` (0, 1, or 2) selects the exit for the current difficulty. This is the mechanism that gives Game 1 a different map topology from Games 2 and 3, and directly mirrors the ROM's `AdjustRoomLevel` subroutine and `RoomDiffs` table:

```typescript
function adjustRoomLevel(room: number): number {
  if (room & 0x80) {
    let newRoomIndex = (room & ~0x80) + gameLevel;
    room = roomLevelDiffs[newRoomIndex];
  }
  return room;
}
```

### The Mirror Flag

When `ROOMFLAG_MIRROR` is set, the right half of the playfield mirrors the left at `cx + PLAYFIELD_COLS`. When clear, the right half is a geometric flip at `40 − (cx + 1)`. The TIA's `CTRLPF` register bit 0 (`REF`) selected between these two modes on the hardware.

---

## The Object System

### Ball Coordinate Resolution

The player's avatar, called the Ball (or the "Ball Man") because it used the TIA's hardware Ball sprite, is stored at twice the resolution of all other objects. This is the source of every `/2` and `*2` conversion throughout `adventure.ts`. The 2× resolution gives ball movement sub-object-pixel precision, allowing it to slide past obstacles more smoothly than a single-unit grid would permit.

```typescript
// Ball positions at 2× resolution relative to all other game objects.
// objectBall.x == 100 is object coordinate 50.
// This double scale is the source of every /2 and *2 throughout adventure.ts.
export const objectBall: BALL = { room: 0, x: 0, y: 0, ... };
```

### State Indirection

Multi-state objects store all states contiguously in one array. `object.state` is not a direct index into that array; instead, it indexes into a small per-object state table that gives the frame offset. This lets states share frames (e.g., dragon walking and reversed-walking both map to the same frame data):

```typescript
// State 0 → frame 0, State 1 → frame 2, State 2 → frame 0, State 3 → frame 1
export const dragonStates = [0, 2, 0, 1];
```

The assembly used similar indirection through the `Store1–Store9` pointer tables.

### Object Initialization Tables

`game1Objects` and `game2Objects` are flat arrays of 7-tuples terminated by `0xff`, corresponding to the ROM's `Game1Objects` and `Game2Objects` data blocks. `setupRoomObjects` reads them in the same sequential scan pattern as the assembly's `CacheObjects`:

```typescript
// Format: objectId, room, x, y, state, movementX, movementY
(ObjectId.RedDragon,
  0x14,
  0x50,
  0x20,
  0x00,
  3,
  3, // Red Dragon
  0xff,
  0,
  0,
  0,
  0,
  0,
  0); // sentinel
```

---

## Collision Detection

### Software Simulation of TIA Registers

The TIA chip latched collision state in hardware — sprites physically overlapping drove collision bits that the CPU polled via registers like `CXP0FB` and `CXP1FB`. There is no equivalent in a browser. Collision is instead computed explicitly each frame, traversing the same packed graphics data that `drawObject` does — so collision geometry exactly matches what the player sees.

### The `displayed` Flag Requirement

On the 2600, TIA collision registers only fired for sprites that were actually being rendered — if an object wasn't drawn that frame (due to multiplexer cycling), it couldn't collide. The `displayed` flag preserves this constraint. `collisionCheckBallWithObjects` only tests objects where `displayed === true`:

```typescript
if (object.displayed && objectBall.room === object.room) {
  if (collisionCheckObject(object, objectBall.x - 4, objectBall.y - 1, 8, 8)) {
    return i;
  }
}
```

### Two-Phase Object-Object Collision

`collisionCheckObjectWithObject` uses two phases:

**Bounding box rejection** via `calcPlayerSpriteExtents` and `hitTestRects` — fast, skips the per-pixel work if bounding boxes don't overlap.

**Block-level scan** — a four-level nested loop (object1 rows → object1 bits → object2 rows → object2 bits) testing each 2×2 block against every block of the other object. `objectY2` intentionally does not reset between `bit1` iterations within a row — matching the original per-pixel hardware collision behavior. X-wrapping is applied to both objects to handle sprites positioned past the right screen edge, which the 2600 allowed.

### Axis-Isolated Ball Collision

Ball movement uses per-axis collision isolation. Each axis is tested at the new position on that axis against the _old_ position on the perpendicular. This lets `resolveCollisions` push the ball back only on the axis that caused the contact, preventing it from getting stuck in corner geometry:

```typescript
// Y movement first, X second. tempX/tempY capture pre-move positions
// so each axis test can hold the other axis constant.
const tempX = objectBall.x;
const tempY = objectBall.y;

ballHandleYRoomWrap(tempX); // uses old X during Y-wrap check
ballCheckYCollision(tempX); // tests (tempX, newY)

objectBall.previousX = objectBall.x;
// ... apply X movement ...
ballCheckXCollision(tempY); // tests (newX, tempY)
```

---

## Enemy AI

### Dragon State Machine

Each dragon runs the same four-state machine with state IDs identical to the ROM's:

| State | Meaning                                 | Assembly label                  |
| ----- | --------------------------------------- | ------------------------------- |
| `0`   | Alive, stalking (seek/flee)             | `MoveDragon` → seek/flee branch |
| `1`   | Dead — no-op each frame                 | dead state in `MoveDragon`      |
| `2`   | Eating — ball locked to dragon position | `dragonHandleEaten`             |
| `3`   | Roaring — countdown before the bite     | `dragonHandleRoar`              |

When the ball contacts a living dragon (state 0), the dragon enters state 3 and a countdown timer is set. If the timer expires and the ball is still in range, the dragon captures the ball (state 2). The player can escape during the countdown — the bite is not immediate.

### Difficulty Effects on Seek and Flee

Two difficulty axes affect dragons independently. The **left switch** controls the roar countdown timer: difficulty B produces a longer countdown (more time to escape); A produces a shorter one. The timer value is read from `dragonDiff[gameLevel * 2 + offset]`, corresponding to the ROM's `DragonDiff` table.

The **right switch** controls whether dragons flee the sword. `dragonSeekFlee` starts at matrix index 0 on difficulty B (includes the flee-from-sword entry) or index 2 on difficulty A (skips it):

```typescript
function dragonSeekFlee(dragon, matrix, speed) {
  const { right } = readDifficultySwitches();
  let i = right === Difficulty.B ? 0 : 2; // B: flee enabled; A: seek only
  // ...
}
```

This directly mirrors the ROM's difficulty register check in `MoveDragon`.

### Bat Fed-Up Timer

The bat uses an inverted patience counter. `0xff` means the bat is hungry and will steal on contact. While holding something the timer increments from 0; when it reaches `0xff` again, the bat seeks a new target:

```typescript
// 0xff = steal immediately; counts up while the bat holds something,
// resets to 0 on pickup. Inverted sense mirrors the original ROM's timer.
let batFedUpTimer: number = 0xff;
```

---

## Atari 2600 Quirks Preserved

### Easter Egg Entry: Hardcoded Room Exit

Room `0x03` ("Left of Name") has no `roomRight` connection to room `0x1E` in `roomDefs` — all its exits are normal. The entry into the Easter egg room is hardcoded in ball movement, exactly as in the ROM:

```typescript
objectBall.room = objectBall.room === 0x3 ? 0x1e : roomDefs[objectBall.room].roomRight;
```

The right thin wall in room `0x03` is ordinarily impassable, but suppresses collision when the Dot object is present in the same room — the same condition the ROM used to guard the Easter egg passage.

### Surround Object in Gray Rooms

The surround is a 32-row solid block drawn beneath the playfield layer in maze (gray) rooms. Without it, the ball's background color bleeds into wall cells. It activates only when `currentRoom.color === COLOR_LTGRAY` and tracks the ball position, corresponding to the ROM's `Surround` routine at `$F9E7`.

### Portcullis State Machine

The portcullis cycles through 23 states. State 0 is open; state 12 is fully closed (impassable); states 13–22 animate the reopening. At state > 22, the counter resets to 0 and the room's downward exit connection is restored. While closed, the exit points at the entry room itself, making the downward passage non-functional. This is a direct port of the ROM's `Portals` routine state machine.

### Flash Color

Objects with `color: COLOR_FLASH` (the Chalice and the Easter egg author text) cycle through a continuously advancing hue and luminance. `advanceFlashColor()` is called once per game tick from `startGame`, so all flash consumers see the same color within a single frame. This replaces the ROM's `ChangeColor` routine's HSL cycling, which was driven by the attract-mode input counter.

The win flash reuses `getFlashColor()` for the room background, applying the same cycling hue to the entire screen rather than to a specific object — the same dual use the ROM made of its flash color state.

### Reset Edge Detection

The 2600's Reset button fired on _release_, not press. The port replicates this by comparing the current switch state against the previous frame's state — action is taken only on the transition from pressed to released:

```typescript
// Fires only on pressed → released transition, matching 2600 hardware.
if (gameState !== GameState.Win && switchReset && !reset) {
  tickResetState();
}
```
