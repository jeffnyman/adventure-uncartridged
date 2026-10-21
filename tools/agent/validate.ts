// Drives the real game with random moves and checks that the model
// predicts every step where the ball touched no object.
import { startGame } from "../../src/adventure.ts";
import { calcPlayerSpriteExtents } from "../../src/adventure.ts";
import { objectBall, objectDefs } from "../../src/data/objects.ts";
import { ObjectId } from "../../src/types.ts";
import { setInput } from "./headless-hardware.ts";
import { DIRS, move } from "./model.ts";

setInput({ reset: true });
startGame();
setInput({});
startGame();

let seed = 12345;
const rand = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

function eaten(): boolean {
  return [ObjectId.YellowDragon, ObjectId.GreenDragon, ObjectId.RedDragon].some(
    (d) => objectDefs[d].linkedObject === ObjectId.Ball,
  );
}

// True if any object in the ball's room is within 24 units of it.
function nearObject(p: { room: number; x: number; y: number }): boolean {
  for (let i = 0; objectDefs[i].graphicsData; i++) {
    const o = objectDefs[i];
    if (o.room !== p.room || i === objectBall.linkedObject) continue;
    const e = calcPlayerSpriteExtents(o);
    if (p.x + 28 > e.x && p.x - 28 < e.x + e.w && p.y + 28 > e.y - e.h && p.y - 28 < e.y)
      return true;
  }
  return false;
}

let checked = 0;
const rooms = new Set<number>();
let mismatches = 0;
let dir = DIRS[0];

for (let cycle = 0; cycle < 100000; cycle++) {
  if (eaten()) {
    // Reset revives the player at the castle. Press, then release.
    setInput({ reset: true });
    startGame();
    setInput({});
    startGame();
    continue;
  }
  if (rand() < 0.15) dir = DIRS[Math.floor(rand() * DIRS.length)];
  const before = { room: objectBall.room, x: objectBall.x, y: objectBall.y };
  const predicted = move(before, dir[0], dir[1], [false, false, false]);

  setInput({ right: dir[0] > 0, left: dir[0] < 0, up: dir[1] > 0, down: dir[1] < 0 });
  // One movement cycle is three frames: Active1, Active2, Active3.
  startGame();
  const touchedObject = objectBall.hitObject >= 0;
  // Wall hits are undone on the second frame, by resolveCollisions.
  startGame();
  startGame();
  const afterMove = { room: objectBall.room, x: objectBall.x, y: objectBall.y };

  if (touchedObject || nearObject(before) || eaten()) continue;
  checked++;
  rooms.add(before.room);
  if (
    predicted.room !== afterMove.room ||
    predicted.x !== afterMove.x ||
    predicted.y !== afterMove.y
  ) {
    mismatches++;
    if (mismatches <= 5)
      console.log("mismatch", before, dir, "predicted", predicted, "actual", afterMove);
  }
}

console.log({ checked, mismatches, roomsVisited: [...rooms].sort((a, b) => a - b).join(",") });
