import { ObjectId, type BALL, type OBJECT } from "../types";
import {
  COLOR_BLACK,
  COLOR_FLASH,
  COLOR_LIMEGREEN,
  COLOR_LTGRAY,
  COLOR_ORANGE,
  COLOR_PURPLE,
  COLOR_RED,
  COLOR_WHITE,
  COLOR_YELLOW,
} from "./colors";

// ============================================================
// Object graphics data
// First byte of each block is height in scan lines.
// Multi-state objects concatenate all state blocks in sequence.
// ============================================================

// Object #0 : Graphic (portcullis — 7 states, open to closed)
// This covers objects: 0, 1, 2 from ObjectId.
export const portStates = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1];

// prettier-ignore
export const objectGfxPort = [
    // state 1
    4,  0xFE,0xAA,0xFE,0xAA,
    // state 2
    6,  0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,
    // state 3
    8,  0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,
    // state 4
    10, 0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,
    // state 5
    12, 0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,
    // state 6
    14, 0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,
    // state 7 (fully closed)
    16, 0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA,0xFE,0xAA
]

// Object #3 : State FF : Graphic (Easter egg author name)
// prettier-ignore
export const objectGfxAuthor = [
    95,
    0xF0, 0x80, 0x80, 0x80, 0xF4, 0x04, 0x87, 0xE5, 0x87, 0x80,
    0x05, 0xE5, 0xA7, 0xE1, 0x87, 0xE0, 0x01, 0xE0, 0xA0, 0xF0,
    0x01, 0x40, 0xE0, 0x40, 0x40, 0x40, 0x01, 0xE0, 0xA0, 0xE0,
    0x80, 0xE0, 0x01, 0x20, 0x20, 0xE0, 0xA0, 0xE0, 0x01, 0x01,
    0x01, 0x88, 0xA8, 0xA8, 0xA8, 0xF8, 0x01, 0xE0, 0xA0, 0xF0,
    0x01, 0x80, 0xE0, 0x8F, 0x89, 0x0F, 0x8A, 0xE9, 0x80, 0x8E,
    0x0A, 0xEE, 0xA0, 0xE8, 0x88, 0xEE, 0x0A, 0x8E, 0xE0, 0xA4,
    0xA4, 0x04, 0x80, 0x08, 0x0E, 0x0A, 0x0A, 0x80, 0x0E, 0x0A,
    0x0E, 0x08, 0x0E, 0x80, 0x04, 0x0E, 0x04, 0x04, 0x04, 0x80,
    0x04, 0x0E, 0x04, 0x04, 0x04
]

// Object #4 : Graphic (number display: states 1, 2, 3)
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
];

// Object #5 : Graphic (dragon: four states — walk, bite, walk-reversed, dead)
// This covers objects: 5, 6, 7 from ObjectId.
export const dragonStates = [0, 2, 0, 1];

// prettier-ignore
export const objectGfxDrag = [
  // State 00 : walking
  20,
  0x06,                  //      XX
  0x0F,                  //     XXXX
  0xF3,                  // XXXX  XX
  0xFE,                  // XXXXXXX
  0x0E,                  //     XXX
  0x04,                  //      X
  0x04,                  //      X
  0x1E,                  //    XXXX
  0x3F,                  //   XXXXXX
  0x7F,                  //  XXXXXXX
  0xE3,                  // XXX   XX
  0xC3,                  // XX    XX
  0xC3,                  // XX    XX
  0xC7,                  // XX   XXX
  0xFF,                  // XXXXXXXX
  0x3C,                  //   XXXX
  0x08,                  //     X
  0x8F,                  // X   XXXX
  0xE1,                  // XXX    X
  0x3F,                  //   XXXXXX
  // State 01 : biting
  22,
  0x80,                  // X
  0x40,                  //  X
  0x26,                  //   X  XX
  0x1F,                  //    XXXXX
  0x0B,                  //     X XX
  0x0E,                  //     XXX
  0x1E,                  //    XXXX
  0x24,                  //   X  X
  0x44,                  //  X   X
  0x8E,                  // X   XXX
  0x1E,                  //    XXXX
  0x3F,                  //   XXXXXX
  0x7F,                  //  XXXXXXX
  0x7F,                  //  XXXXXXX
  0x7F,                  //  XXXXXXX
  0x7F,                  //  XXXXXXX
  0x3E,                  //   XXXXX
  0x1C,                  //    XXX
  0x08,                  //     X
  0xF8,                  // XXXXX
  0x80,                  // X
  0xE0,                  // XXX
  // State 02 : walking reversed
  17,
  0x0C,                  //     XX
  0x0C,                  //     XX
  0x0C,                  //     XX
  0x0E,                  //     XXX
  0x1B,                  //    XX X
  0x7F,                  //  XXXXXXX
  0xCE,                  // XX  XXX
  0x80,                  // X
  0xFC,                  // XXXXXX
  0xFE,                  // XXXXXXX
  0xFE,                  // XXXXXXX
  0x7E,                  //  XXXXXX
  0x78,                  //  XXXX
  0x20,                  //   X
  0x6E,                  //  XX XXX
  0x42,                  //  X    X
  0x7E                   //  XXXXXX
];

// Object #8 : State FF : Graphic
// prettier-ignore
export const objectGfxSword = [
  5,
  0x20,                  //   X
  0x40,                  //  X
  0xFF,                  // XXXXXXXX
  0x40,                  //  X
  0x20                   //   X
];

// Object #9: State FF : Graphic
// prettier-ignore
export const objectGfxBridge = [
  24,
  0xC3, 0xC3, 0xC3, 0xC3,   // XX    XX (×4)
  0x42, 0x42, 0x42, 0x42,   //  X    X  (×4)
  0x42, 0x42, 0x42, 0x42,   //  X    X  (×4)
  0x42, 0x42, 0x42, 0x42,   //  X    X  (×4)
  0x42, 0x42, 0x42, 0x42,   //  X    X  (×4)
  0xC3, 0xC3, 0xC3, 0xC3    // XX    XX (×4)
];

// Object 0x0A (10) : State FF : Graphic
// This covers objects: 10, 11, 12 from ObjectId.
// prettier-ignore
export const objectGfxKey = [
  3,
  0x07,                  //      XXX
  0xFD,                  // XXXXXX X
  0xA7                   // X X  XXX
];

// Object 0x0D (13) : Graphic (bat: two states — folded wings, open wings)
export const batStates = [0, 1];

// prettier-ignore
export const objectGfxBat = [
  // State 03 : folded wings
  7,
  0x81,                  // X      X
  0x81,                  // X      X
  0xC3,                  // XX    XX
  0xC3,                  // XX    XX
  0xFF,                  // XXXXXXXX
  0x5A,                  //  X XX X
  0x66,                  //  XX  XX
  // State FF : open wings
  11,
  0x01,                  //        X
  0x80,                  // X
  0x01,                  //        X
  0x80,                  // X
  0x3C,                  //   XXXX
  0x5A,                  //  X XX X
  0x66,                  //  XX  XX
  0xC3,                  // XX    XX
  0x81,                  // X      X
  0x81,                  // X      X
  0x81                   // X      X
];

// Object 0x0E (14) : State FF : Graphic
// prettier-ignore
export const objectGfxDot = [
  1,
  0x80                   // X
];

// Object 0x0F (15) : State FF : Graphic
// prettier-ignore
export const objectGfxChalice = [
  9,
  0x81,                  // X      X
  0x81,                  // X      X
  0xC3,                  // XX    XX
  0x7E,                  //  XXXXXX
  0x7E,                  //  XXXXXX
  0x3C,                  //   XXXX
  0x18,                  //    XX
  0x18,                  //    XX
  0x7E                   //  XXXXXX
];

// Object 0x10 (16) : State FF : Graphic
// prettier-ignore
export const objectGfxMagnet = [
  8,
  0x3C,                  //   XXXX
  0x7E,                  //  XXXXXX
  0xE7,                  // XXX  XXX
  0xC3,                  // XX    XX
  0xC3,                  // XX    XX
  0xC3,                  // XX    XX
  0xC3,                  // XX    XX
  0xC3                   // XX    XX
];

// Surround : Graphic
// This is not a numbered game object.
// prettier-ignore
export const objectGfxSurround = [
  32,
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,   // XXXXXXXX (×8)
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,   // XXXXXXXX (×8)
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,   // XXXXXXXX (×8)
  0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF    // XXXXXXXX (×8)
];

// Indexed array of all game objects and their properties.
export const objectDefs: OBJECT[] = [
  {
    graphicsData: objectGfxPort,
    states: portStates,
    state: 0,
    color: COLOR_BLACK,
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
  }, // #0 Portcullis #1
  {
    graphicsData: objectGfxPort,
    states: portStates,
    state: 0,
    color: COLOR_BLACK,
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
  }, // #1 Portcullis #2
  {
    graphicsData: objectGfxPort,
    states: portStates,
    state: 0,
    color: COLOR_BLACK,
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
  }, // #2 Portcullis #3
  {
    graphicsData: objectGfxAuthor,
    states: [0],
    state: 0,
    color: COLOR_FLASH,
    room: 0x1e,
    x: 0x50,
    y: 0x69,
    movementX: 0,
    movementY: 0,
    size: 0,
    linkedObject: 0,
    linkedObjectX: 0,
    linkedObjectY: 0,
    displayed: false,
  }, // #3 Name
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
  }, // # 4 Number
  {
    graphicsData: objectGfxDrag,
    states: dragonStates,
    state: 0,
    color: COLOR_RED,
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
  }, // #5 Dragon #1
  {
    graphicsData: objectGfxDrag,
    states: dragonStates,
    state: 0,
    color: COLOR_YELLOW,
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
  }, // #6 Dragon #2
  {
    graphicsData: objectGfxDrag,
    states: dragonStates,
    state: 0,
    color: COLOR_LIMEGREEN,
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
  }, // #7 Dragon #3
  {
    graphicsData: objectGfxSword,
    states: [0],
    state: 0,
    color: COLOR_YELLOW,
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
  }, // #8 Sword
  {
    graphicsData: objectGfxBridge,
    states: [0],
    state: 0,
    color: COLOR_PURPLE,
    room: -1,
    x: 0,
    y: 0,
    movementX: 0,
    movementY: 0,
    size: 0x07,
    linkedObject: 0,
    linkedObjectX: 0,
    linkedObjectY: 0,
    displayed: false,
  }, // #9 Bridge
  {
    graphicsData: objectGfxKey,
    states: [0],
    state: 0,
    color: COLOR_YELLOW,
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
  }, // #0A (10) - Key #1
  {
    graphicsData: objectGfxKey,
    states: [0],
    state: 0,
    color: COLOR_WHITE,
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
  }, // #0B (11) - Key #2
  {
    graphicsData: objectGfxKey,
    states: [0],
    state: 0,
    color: COLOR_BLACK,
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
  }, // #0C (12) - Key #3
  {
    graphicsData: objectGfxBat,
    states: batStates,
    state: 0,
    color: COLOR_BLACK,
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
  }, // #0D (13) - Bat
  {
    graphicsData: objectGfxDot,
    states: [0],
    state: 0,
    color: COLOR_LTGRAY,
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
  }, // #0E (14) - Black Dot
  {
    graphicsData: objectGfxChalice,
    states: [0],
    state: 0,
    color: COLOR_FLASH,
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
  }, // #0F (15) Chalice
  {
    graphicsData: objectGfxMagnet,
    states: [0],
    state: 0,
    color: COLOR_BLACK,
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
  }, // #0x10 (16) Magnet
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
  }, // # Null
];

// The ball (the player's avatar in the original 2600, which used
// the hardware Ball sprite for the player). Ball positions are
// stored at 2× resolution relative to all other game objects.
// objectBall.x == 100 is object coordinate 50. This double scale
// is the source of every /2 and *2 conversion throughout the main
// adventure module.
export const objectBall: BALL = {
  room: 0,
  x: 0,
  y: 0,
  previousX: 0,
  previousY: 0,
  linkedObject: ObjectId.None,
  linkedObjectX: 0,
  linkedObjectY: 0,
  hitX: false,
  hitY: false,
  hitObject: ObjectId.None,
};

// Object starting positions for game 1
// Format per entry: objectId, room, x, y, state, movementX, movementY
// Terminated by 0xff sentinel
// prettier-ignore
export const game1Objects = [
  ObjectId.Port1,        0x11, 0x4d, 0x31, 0x0C, 0x00, 0x00,   // Port 1
  ObjectId.Port2,        0x0F, 0x4d, 0x31, 0x0C, 0x00, 0x00,   // Port 2
  ObjectId.Port3,        0x10, 0x4d, 0x31, 0x0C, 0x00, 0x00,   // Port 3
  ObjectId.RedDragon,    0x0E, 0x50, 0x20, 0x00, 0x00, 0x00,   // Red Dragon
  ObjectId.YellowDragon, 0x01, 0x50, 0x20, 0x00, 0x00, 0x00,   // Yellow Dragon
  ObjectId.GreenDragon,  0x1D, 0x50, 0x20, 0x00, 0x00, 0x00,   // Green Dragon
  ObjectId.Sword,        0x12, 0x20, 0x20, 0x00, 0x00, 0x00,   // Sword
  ObjectId.Bridge,       0x04, 0x2A, 0x37, 0x00, 0x00, 0x00,   // Bridge
  ObjectId.YellowKey,    0x11, 0x20, 0x40, 0x00, 0x00, 0x00,   // Yellow Key
  ObjectId.WhiteKey,     0x0E, 0x20, 0x40, 0x00, 0x00, 0x00,   // White Key
  ObjectId.BlackKey,     0x1D, 0x20, 0x40, 0x00, 0x00, 0x00,   // Black Key
  ObjectId.Bat,          0x1A, 0x20, 0x20, 0x00, 0x00, 0x00,   // Bat
  ObjectId.Dot,          0x15, 0x51, 0x12, 0x00, 0x00, 0x00,   // Dot
  ObjectId.Chalice,      0x1C, 0x30, 0x20, 0x00, 0x00, 0x00,   // Chalice
  ObjectId.Magnet,       0x1B, 0x80, 0x20, 0x00, 0x00, 0x00,   // Magnet
  0xff, 0, 0, 0, 0, 0, 0
]

// Object starting positions for games 2 and 3
// Game 3 uses these as a baseline then randomizes positions
// prettier-ignore
export const game2Objects = [
  ObjectId.Port1,        0x11, 0x4d, 0x31, 0x0C, 0x00, 0x00,   // Port 1
  ObjectId.Port2,        0x0F, 0x4d, 0x31, 0x0C, 0x00, 0x00,   // Port 2
  ObjectId.Port3,        0x10, 0x4d, 0x31, 0x0C, 0x00, 0x00,   // Port 3
  ObjectId.RedDragon,    0x14, 0x50, 0x20, 0x00, 3, 3,         // Red Dragon
  ObjectId.YellowDragon, 0x19, 0x50, 0x20, 0x00, 3, 3,         // Yellow Dragon
  ObjectId.GreenDragon,  0x04, 0x50, 0x20, 0x00, 3, 3,         // Green Dragon
  ObjectId.Sword,        0x11, 0x20, 0x20, 0x00, 0x00, 0x00,   // Sword
  ObjectId.Bridge,       0x0B, 0x40, 0x40, 0x00, 0x00, 0x00,   // Bridge
  ObjectId.YellowKey,    0x09, 0x20, 0x40, 0x00, 0x00, 0x00,   // Yellow Key
  ObjectId.WhiteKey,     0x06, 0x20, 0x40, 0x00, 0x00, 0x00,   // White Key
  ObjectId.BlackKey,     0x19, 0x20, 0x40, 0x00, 0x00, 0x00,   // Black Key
  ObjectId.Bat,          0x02, 0x20, 0x20, 0x00, 0, -3,        // Bat
  ObjectId.Dot,          0x15, 0x45, 0x12, 0x00, 0x00, 0x00,   // Dot
  ObjectId.Chalice,      0x14, 0x30, 0x20, 0x00, 0x00, 0x00,   // Chalice
  ObjectId.Magnet,       0x0E, 0x80, 0x20, 0x00, 0x00, 0x00,   // Magnet
  0xff, 0, 0, 0, 0, 0, 0
]

// Special Object : Surround

export const objectSurround: OBJECT = {
  graphicsData: objectGfxSurround,
  states: [0],
  state: 0,
  color: COLOR_ORANGE,
  room: -1,
  x: 0,
  y: 0,
  movementX: 0,
  movementY: 0,
  size: 0x07,
  linkedObject: ObjectId.None,
  linkedObjectX: 0,
  linkedObjectY: 0,
  displayed: true,
};
