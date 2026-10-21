// Replays a recorded input file into a fresh headless game and
// reports the frame on which the chalice reaches the yellow castle.
//
// Usage: node --import ./tools/agent/register.mjs tools/agent/replay.ts [file.json]

import { readFileSync } from "node:fs";
import { startGame } from "../../src/adventure.ts";
import { objectDefs } from "../../src/data/objects.ts";
import { ObjectId } from "../../src/types.ts";
import { setDifficulty, setInput } from "./headless-hardware.ts";

const file = process.argv[2] ?? "tools/agent/game1-win.json";
const run = JSON.parse(readFileSync(file, "utf8")) as {
  difficulty: { left: "A" | "B"; right: "A" | "B" };
  frames: number[];
};

setDifficulty(run.difficulty.left, run.difficulty.right);

let wonAt = -1;
run.frames.forEach((bits, i) => {
  setInput({
    up: (bits & 1) > 0,
    down: (bits & 2) > 0,
    left: (bits & 4) > 0,
    right: (bits & 8) > 0,
    fire: (bits & 16) > 0,
    reset: (bits & 32) > 0,
    select: (bits & 64) > 0,
  });
  startGame();
  if (wonAt < 0 && objectDefs[ObjectId.Chalice].room === 0x12) wonAt = i + 1;
});

console.log(wonAt > 0 ? `won after ${wonAt} frames` : "did not win");
process.exitCode = wonAt > 0 ? 0 : 1;
