// A planning agent that plays Game 1 to a win, following a known
// human route: take the yellow key, open the yellow castle, take the
// sword, kill the yellow and green dragons, swap the sword for the
// black key, open the black castle, take the chalice and carry it
// home to the yellow castle.
//
// It plans paths with model.ts, replans whenever the game drifts
// from the plan, and presses Reset if a dragon eats the player.
//
// Usage: node --import ./tools/agent/register.mjs tools/agent/agent.ts [out.json]

import { writeFileSync } from "node:fs";
import { collisionCheckObjectWithObject, startGame } from "../../src/adventure.ts";
import { objectBall, objectDefs } from "../../src/data/objects.ts";
import { ObjectId } from "../../src/types.ts";
import { type Input, setDifficulty, setInput } from "./headless-hardware.ts";
import { PORTS, type Pos, move, plan, touches } from "./model.ts";

const YELLOW_CASTLE_INSIDE = 0x12;
const BLACK_CASTLE_INSIDE = 0x1b;
const CARRYABLE = [
  ObjectId.Sword,
  ObjectId.Bridge,
  ObjectId.YellowKey,
  ObjectId.WhiteKey,
  ObjectId.BlackKey,
  ObjectId.Dot,
  ObjectId.Chalice,
  ObjectId.Magnet,
];
const DRAGONS = [ObjectId.YellowDragon, ObjectId.GreenDragon, ObjectId.RedDragon];

// ---------------------------------------------------------------
// Driving the game and recording every frame's input.

const frames: number[] = [];

function encode(i: Input): number {
  return (
    (i.up ? 1 : 0) |
    (i.down ? 2 : 0) |
    (i.left ? 4 : 0) |
    (i.right ? 8 : 0) |
    (i.fire ? 16 : 0) |
    (i.reset ? 32 : 0) |
    (i.select ? 64 : 0)
  );
}

function tick(input: Input): void {
  setInput(input);
  startGame();
  frames.push(encode(input));
}

// Press and release Reset. The game acts on the release, and the
// next frame is always the first of a three-frame movement cycle.
function pressReset(): void {
  tick({ reset: true });
  tick({});
}

// One movement cycle: the ball moves on the first of three frames.
function cycle(dx: number, dy: number): void {
  const input = { right: dx > 0, left: dx < 0, up: dy > 0, down: dy < 0 };
  tick(input);
  tick(input);
  tick(input);
}

const ball = (): Pos => ({ room: objectBall.room, x: objectBall.x, y: objectBall.y });
const carrying = (): number => objectBall.linkedObject;
const won = (): boolean => objectDefs[ObjectId.Chalice].room === YELLOW_CASTLE_INSIDE;
const eaten = (): boolean => DRAGONS.some((d) => objectDefs[d].linkedObject === ObjectId.Ball);
const gateOpen = (): boolean[] => PORTS.map((p) => objectDefs[p].state !== 12);
const same = (a: Pos, b: Pos): boolean => a.room === b.room && a.x === b.x && a.y === b.y;

// Whether the carried object, with the ball at p, would overlap
// object `target`. Mirrors the offset logic in moveCarriedObject.
function carriedTouches(p: Pos, target: number): boolean {
  const held = objectDefs[carrying()];
  const t = objectDefs[target];
  if (!held || t.room !== p.room) return false;
  const x = p.x / 2 + objectBall.linkedObjectX;
  const y = p.y / 2 + objectBall.linkedObjectY;
  return collisionCheckObjectWithObject(t, { ...held, x, y, room: p.room });
}

// Positions the planner must not step on: carryable objects other
// than the one we want (touching one swaps it into our hand), and
// live dragons we are not trying to kill.
function blocked(p: Pos, wanted: number, prey: number): boolean {
  for (const id of CARRYABLE) {
    if (id === wanted || id === carrying()) continue;
    if (objectDefs[id].room === p.room && touches(id, p.x, p.y)) return true;
  }
  for (const id of DRAGONS) {
    if (id === prey || objectDefs[id].state === 1) continue;
    if (objectDefs[id].room === p.room && touches(id, p.x, p.y)) return true;
  }
  return false;
}

// ---------------------------------------------------------------
// The route, as goals checked in order against the game state.

interface Goal {
  name: string;
  done: () => boolean;
  reached: (p: Pos) => boolean;
  wanted?: number;
  prey?: number;
}

const touchGoal = (name: string, id: number): Goal => ({
  name,
  done: () => carrying() === id,
  reached: (p) => objectDefs[id].room === p.room && touches(id, p.x, p.y),
  wanted: id,
});

const killGoal = (name: string, dragon: number): Goal => ({
  name,
  done: () => objectDefs[dragon].state === 1,
  reached: (p) => carrying() === ObjectId.Sword && carriedTouches(p, dragon),
  prey: dragon,
});

const openGoal = (name: string, port: number): Goal => ({
  name,
  done: () => objectDefs[port].state !== 12,
  reached: (p) => carriedTouches(p, port),
});

const goals: Goal[] = [
  touchGoal("take the yellow key", ObjectId.YellowKey),
  openGoal("open the yellow castle", ObjectId.Port1),
  {
    name: "enter the yellow castle",
    done: () => objectBall.room === YELLOW_CASTLE_INSIDE,
    reached: (p) => p.room === YELLOW_CASTLE_INSIDE,
  },
  touchGoal("take the sword", ObjectId.Sword),
  killGoal("kill the yellow dragon", ObjectId.YellowDragon),
  killGoal("kill the green dragon", ObjectId.GreenDragon),
  touchGoal("swap the sword for the black key", ObjectId.BlackKey),
  openGoal("open the black castle", ObjectId.Port3),
  {
    name: "enter the black castle",
    done: () => objectBall.room === BLACK_CASTLE_INSIDE || carrying() === ObjectId.Chalice,
    reached: (p) => p.room === BLACK_CASTLE_INSIDE,
  },
  touchGoal("take the chalice", ObjectId.Chalice),
  {
    name: "carry the chalice home",
    done: won,
    reached: (p) => p.room === YELLOW_CASTLE_INSIDE,
  },
];

// ---------------------------------------------------------------
// Main loop.

const MAX_FRAMES = 60 * 60 * 20;
let goalIndex = 0;
let path: Array<[number, number]> = [];
let expected: Pos | null = null;
let waiting = 0;
let resets = 0;
const log: string[] = [];

function note(message: string): void {
  const line = `frame ${String(frames.length).padStart(6)}  ${message}`;
  log.push(line);
  console.log(line);
}

// Right difficulty A: dragons do not flee the sword, so they come
// to the player instead of running off. Left stays at B, the
// default, which gives the longest pause before a bite.
const DIFFICULTY = { left: "B", right: "A" } as const;
setDifficulty(DIFFICULTY.left, DIFFICULTY.right);

pressReset();
note(`game 1 started, difficulty left ${DIFFICULTY.left}, right ${DIFFICULTY.right}`);

while (!won() && frames.length < MAX_FRAMES) {
  if (eaten()) {
    resets++;
    note(`eaten by a dragon, pressing Reset (reset ${resets})`);
    pressReset();
    path = [];
    expected = null;
    goalIndex = 0;
    continue;
  }

  // Skip goals already satisfied, for example after a reset.
  while (goalIndex < goals.length && goals[goalIndex].done()) {
    note(`done: ${goals[goalIndex].name}`);
    goalIndex++;
    path = [];
  }
  if (goalIndex >= goals.length) break;
  const goal = goals[goalIndex];

  const here = ball();
  const chasing = goal.prey !== undefined;
  const drifted = expected !== null && !same(expected, here);

  if (path.length === 0 || drifted || chasing) {
    const found = plan(
      here,
      (p) => goal.reached(p),
      gateOpen(),
      chasing ? 60_000 : 400_000,
      (p) => blocked(p, goal.wanted ?? -1, goal.prey ?? -1),
    );
    if (!found) {
      // No route right now, for example a dragon in the way. Wait.
      waiting++;
      if (waiting % 50 === 1) note(`no path for "${goal.name}", waiting`);
      cycle(0, 0);
      expected = null;
      continue;
    }
    path = found;
  }

  waiting = 0;
  const [dx, dy] = path.length ? path.shift()! : [0, 0];
  expected = move(here, dx, dy, gateOpen());
  cycle(dx, dy);
}

if (won()) {
  note("the chalice is home: game won");
  // Let the victory flash play for the recording.
  for (let i = 0; i < 240; i++) tick({});
} else {
  note(`gave up on "${goals[goalIndex]?.name}"`);
}

const out = process.argv[2] ?? "tools/agent/game1-win.json";
writeFileSync(out, JSON.stringify({ game: 1, difficulty: DIFFICULTY, frames, log }));
console.log(`${frames.length} frames written to ${out}`);
