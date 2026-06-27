import { ObjectId } from "../types";

// Dragon behavior matrices are the same format for all three
// dragons. Each entry is a pair [fleeObject, seekObject],
// terminated by [0x00, 0x00]. dragonComputeTarget reads one
// pair at a time; the first pair whose object is present in
// the dragon's room wins, and the rest are ignored.
//
// Flee vs seek is encoded via a self-reference trick: if fleeObject
// is the dragon itself, objectDefs[fleeObject] == dragon is true,
// so the flee branch is skipped and seekObject is chased instead.
// When fleeObject is something else (e.g. Sword), the dragon runs
// from it if it is in the room.
//
// The first pair is always [Sword, DragonItself]: the flee-sword
// entry. This is the entry that Difficulty A skips by starting
// matrix traversal at index 2.

// prettier-ignore
export const greenDragonMatrix = [
  ObjectId.Sword, ObjectId.GreenDragon,
  ObjectId.GreenDragon, ObjectId.Ball,
  ObjectId.GreenDragon, ObjectId.Chalice,
  ObjectId.GreenDragon, ObjectId.Bridge,
  ObjectId.GreenDragon, ObjectId.Magnet,
  ObjectId.GreenDragon, ObjectId.BlackKey,
  0x00, 0x00,
];

// prettier-ignore
export const yellowDragonMatrix = [
  ObjectId.Sword, ObjectId.YellowDragon,
  ObjectId.YellowKey, ObjectId.YellowDragon,
  ObjectId.YellowDragon, ObjectId.Ball,
  ObjectId.YellowDragon, ObjectId.Chalice,
  0x00, 0x00,
];

// prettier-ignore
export const redDragonMatrix = [
  ObjectId.Sword, ObjectId.RedDragon,
  ObjectId.RedDragon, ObjectId.Ball,
  ObjectId.RedDragon, ObjectId.Chalice,
  ObjectId.RedDragon, ObjectId.WhiteKey,
  0x00, 0x00,
];

// Dragon AI timer thresholds indexed by [level*2 + difficultyOffset]
// prettier-ignore
export const dragonDiff = [
  0xd0, 0xe8, // Level 1 : Amateur, Professional
  0xf0, 0xf6, // Level 2 : Amateur, Professional
  0xf0, 0xf6, // Level 3 : Amateur, Professional
];
