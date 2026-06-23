import type { OBJECT } from "../types";
import { COLOR_LIMEGREEN } from "./colors";

// ============================================================
// Object graphics data
// First byte of each block is height in scan lines.
// Multi-state objects concatenate all state blocks in sequence.
// ============================================================

// Object #5 : Graphic (number display: states 1, 2, 3)
const numberStates = [0, 1, 2];

// prettier-ignore
export const objectGfxNum = [
    // State #1 : '1'
    7,
    0x04,                  //  X
    0x0C,                  // XX
    0x04,                  //  X
    0x04,                  //  X
    0x04,                  //  X
    0x04,                  //  X
    0x0E,                  // XXX
    // State #2 : '2'
    7,
    0x0E,                  //  XXX
    0x11,                  // X   X
    0x01,                  //     X
    0x02,                  //    X
    0x04,                  //   X
    0x08,                  //  X
    0x1F,                  // XXXXX
    // State #3 : '3'
    7,
    0x0E,                  //  XXX
    0x11,                  // X   X
    0x01,                  //     X
    0x06,                  //   XX
    0x01,                  //     X
    0x11,                  // X   X
    0x0E                   //  XXX
]

// Indexed array of all game objects and their properties.
export const objectDefs: OBJECT[] = [
  {
    graphicsData: objectGfxNum,
    states: numberStates,
    state: 0,
    color: COLOR_LIMEGREEN,
    room: 0x00,
    x: 0x50,
    y: 0x40,
    movementX: 0,
    movementY: 0,
    size: 0,
    linkedObject: 0,
    linkedObjectX: 0,
    linkedObjectY: 0,
    displayed: false,
  }, // # 5 Number
  {
    graphicsData: null,
    states: [0],
    state: 0,
    color: 0,
    room: -1,
    x: 0,
    y: 0,
    movementX: 0,
    movementY: 0,
    size: 0,
    linkedObject: 0,
    linkedObjectX: 0,
    linkedObjectY: 0,
    displayed: false,
  }, // # 12 Null
];
