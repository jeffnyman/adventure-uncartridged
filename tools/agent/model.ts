// A model of how the player's square moves, mirroring ballMovement,
// the room-wrap handlers and resolveCollisions in src/adventure.ts.
// It uses the game's own exported collision helpers and room tables,
// so walls are tested exactly as the game tests them. It ignores
// objects: dragons, keys and the bat are handled by the agent.

import { collisionCheckObject, hitTestRects, setPlayfieldBit } from "../../src/adventure.ts";
import { OVERSCAN, PLAYFIELD_COLS, SCREEN_HEIGHT, SCREEN_WIDTH } from "../../src/constants.ts";
import { objectDefs } from "../../src/data/objects.ts";
import {
  castleRoomOffsets,
  entryRoomOffsets,
  ROOMFLAG_LEFTTHINWALL,
  ROOMFLAG_MIRROR,
  ROOMFLAG_RIGHTTHINWALL,
  roomDefs,
  roomLevelDiffs,
} from "../../src/data/rooms.ts";
import { ObjectId } from "../../src/types.ts";

export interface Pos {
  room: number;
  x: number;
  y: number;
}

export const PORTS = [ObjectId.Port1, ObjectId.Port2, ObjectId.Port3];

let gameLevel = 0;
export function setLevel(level: number): void {
  gameLevel = level;
}

export function adjustRoomLevel(room: number): number {
  return room & 0x80 ? roomLevelDiffs[(room & ~0x80) + gameLevel] : room;
}

const wallMemo = new Map<number, boolean>();

export function clearWallMemo(): void {
  wallMemo.clear();
}

// Mirrors collisionCheckBallWithWalls.
export function hitsWall(room: number, x: number, y0: number): boolean {
  const key = room * 1_000_000 + (x + 100) * 1000 + (y0 + 100);
  const cached = wallMemo.get(key);
  if (cached !== undefined) return cached;

  let hit = false;
  const y = y0 - 30;
  const def = roomDefs[room];
  const mirror = def.flags & ROOMFLAG_MIRROR;

  if (def.flags & ROOMFLAG_LEFTTHINWALL && x - 8 < 0x0d * 2) hit = true;
  if (def.flags & ROOMFLAG_RIGHTTHINWALL && x + 4 > 0x96 * 2) {
    if (objectDefs[ObjectId.Dot].room !== room) hit = true;
  }

  if (!hit) {
    setPlayfieldBit(def.graphicsData, (cx, ypos) => {
      const other = mirror ? cx + PLAYFIELD_COLS : 40 - (cx + 1);
      if (
        hitTestRects(x - 4, y - 4, 8, 8, cx * 8, ypos * 32, 8, 32) ||
        hitTestRects(x - 4, y - 4, 8, 8, other * 8, ypos * 32, 8, 32)
      ) {
        hit = true;
        return true;
      }
    });
  }

  wallMemo.set(key, hit);
  return hit;
}

// Whether the ball at (x, y) touches object `id`, using the same
// rectangle the game uses for ball-object contact.
export function touches(id: number, x: number, y: number): boolean {
  return collisionCheckObject(objectDefs[id], x - 4, y - 1, 8, 8);
}

// Mirrors one Active1 movement step. dx and dy are -1, 0 or 1,
// with dy = 1 meaning up the screen. gateOpen says which castle
// gates the ball may walk through.
export function move(p: Pos, dx: number, dy: number, gateOpen: boolean[]): Pos {
  const tempX = p.x;
  const tempY = p.y;
  let { room, x, y } = p;
  let prevY = y;
  let hitY = false;

  y += 6 * dy;

  if (y > OVERSCAN + SCREEN_HEIGHT + 6) {
    y = OVERSCAN + OVERSCAN - 2;
    prevY = y;
    room = adjustRoomLevel(roomDefs[room].roomUp);
  } else if (y < 0x0d * 2) {
    const entry = entryRoomOffsets.indexOf(room);
    if (entry >= 0) {
      x = 0xa0;
      y = 0x2c * 2;
      prevY = y;
      room = adjustRoomLevel(castleRoomOffsets[entry]);
    } else {
      const newY = SCREEN_HEIGHT + OVERSCAN;
      const down = adjustRoomLevel(roomDefs[room].roomDown);
      if (hitsWall(down, tempX, newY)) {
        hitY = true;
      } else {
        y = newY;
        room = down;
      }
    }
  }

  if (!hitY && hitsWall(room, tempX, y)) hitY = true;

  const prevX = x;
  x += 6 * dx;
  let hitX = false;

  if (x >= SCREEN_WIDTH - 4) {
    x = 5;
    room = adjustRoomLevel(room === 0x3 ? 0x1e : roomDefs[room].roomRight);
  } else if (x < 4) {
    x = SCREEN_WIDTH - 5;
    room = adjustRoomLevel(roomDefs[room].roomLeft);
  }

  if (hitsWall(room, x, tempY)) hitX = true;
  if (hitX) x = prevX;
  if (hitY) y = prevY;

  // Walking into an open gate moves the ball inside the castle.
  for (let i = 0; i < 3; i++) {
    const port = objectDefs[PORTS[i]];
    if (port.room === room && gateOpen[i] && touches(PORTS[i], x, y)) {
      room = entryRoomOffsets[i];
      y = OVERSCAN + OVERSCAN - 2;
      break;
    }
  }

  return { room, x, y };
}

export const DIRS: Array<[number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const keyOf = (p: Pos): number => p.room * 1_000_000 + (p.x + 100) * 1000 + (p.y + 100);

// Breadth-first search over ball positions until `goal` holds.
// Returns the list of moves, or null if no path exists.
export function plan(
  start: Pos,
  goal: (p: Pos) => boolean,
  gateOpen: boolean[],
  maxNodes = 400_000,
  isBlocked: (p: Pos) => boolean = () => false,
): Array<[number, number]> | null {
  if (goal(start)) return [];

  const prev = new Map<number, { from: number; dir: number }>();
  const startKey = keyOf(start);
  prev.set(startKey, { from: -1, dir: -1 });
  let frontier: Pos[] = [start];

  while (frontier.length && prev.size < maxNodes) {
    const next: Pos[] = [];

    for (const p of frontier) {
      const pk = keyOf(p);

      for (let d = 0; d < DIRS.length; d++) {
        const q = move(p, DIRS[d][0], DIRS[d][1], gateOpen);
        const qk = keyOf(q);
        if (prev.has(qk)) continue;
        prev.set(qk, { from: pk, dir: d });
        if (isBlocked(q) && !goal(q)) continue;

        if (goal(q)) {
          const path: Array<[number, number]> = [];
          let k = qk;
          while (k !== startKey) {
            const step = prev.get(k)!;
            path.push(DIRS[step.dir]);
            k = step.from;
          }
          return path.reverse();
        }

        next.push(q);
      }
    }

    frontier = next;
  }

  return null;
}
