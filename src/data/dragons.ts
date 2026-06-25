import { ObjectId } from "../types";

export const greenDragonMatrix = [
  ObjectId.Sword,
  ObjectId.GreenDragon,
  ObjectId.GreenDragon,
  ObjectId.Ball,
  ObjectId.GreenDragon,
  ObjectId.Chalice,
  ObjectId.GreenDragon,
  ObjectId.Bridge,
  ObjectId.GreenDragon,
  ObjectId.Magnet,
  ObjectId.GreenDragon,
  ObjectId.BlackKey,
  0x00,
  0x00,
];

// Dragon AI timer thresholds indexed by [level*2 + difficultyOffset]
export const dragonDiff = [
  0xd0,
  0xe8, // Level 1 : Amateur, Professional
  0xf0,
  0xf6, // Level 2 : Amateur, Professional
  0xf0,
  0xf6, // Level 3 : Amateur, Professional
];
