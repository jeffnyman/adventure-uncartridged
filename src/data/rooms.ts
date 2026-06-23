import type { ROOM } from "../types";
import { COLOR_PURPLE } from "./colors";

export const ROOMFLAG_NONE = 0x00;
export const ROOMFLAG_MIRROR = 0x01;
export const ROOMFLAG_LEFTTHINWALL = 0x02;
export const ROOMFLAG_RIGHTTHINWALL = 0x04;

// ============================================================
// Room graphics data
// Each room is 21 bytes: 7 rows × 3 bytes (PF0, PF1, PF2)
// ============================================================

// prettier-ignore
export const roomGfxNumberRoom = [
    0xF0,0xFF,0xFF,     // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
]

// Indexed array of all rooms and their properties.
export const roomDefs: ROOM[] = [
  {
    graphicsData: roomGfxNumberRoom,
    flags: ROOMFLAG_NONE,
    color: COLOR_PURPLE,
    roomUp: 0x00,
    roomRight: 0x00,
    roomDown: 0x00,
    roomLeft: 0x00,
  }, // 0 - Number Room
];
