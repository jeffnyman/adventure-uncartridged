import { ObjectId, type ROOM } from "../types";
import {
  COLOR_BLACK,
  COLOR_BLUE,
  COLOR_CYAN,
  COLOR_DKGREEN,
  COLOR_LIMEGREEN,
  COLOR_LTCYAN,
  COLOR_LTGRAY,
  COLOR_OLIVEGREEN,
  COLOR_PURPLE,
  COLOR_RED,
  COLOR_TAN,
  COLOR_WHITE,
  COLOR_YELLOW,
} from "./colors";

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
];

// prettier-ignore
const roomGfxBelowYellowCastle = [
  0xF0,0xFF,0x0F,     // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0xF0,0xFF,0xFF      // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxLeftOfName = [
  0xF0,0xFF,0xFF,     // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxBlueMazeTop = [
  0xF0,0xFF,0x0F,     // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x00,0x0C,0x0C,     //         XX    XX        RR    RR
  0xF0,0x0C,0x3C,     // XXXX    XX    XXXX    RRRR    RR    RRRR
  0xF0,0x0C,0x00,     // XXXX    XX                    RR    RRRR
  0xF0,0xFF,0x3F,     // XXXXXXXXXXXXXXXXXX    RRRRRRRRRRRRRRRRRR
  0x00,0x30,0x30,     //       XX        XX    RR        RR
  0xF0,0x33,0x3F      // XXXX  XX  XXXXXXXX    RRRRRRRR  RR  RRRR
];

// prettier-ignore
const roomGfxBlueMaze1 = [
  0xF0,0xFF,0xFF,     // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0xF0,0xFC,0xFF,     // XXXXXXXXXX  XXXXXXXXRRRRRRRR  RRRRRRRRRR
  0xF0,0x00,0xC0,     // XXXX              XXRR              RRRR
  0xF0,0x3F,0xCF,     // XXXX  XXXXXXXXXX  XXRR  RRRRRRRRRR  RRRR
  0x00,0x30,0xCC,     //       XX      XX  XXRR  RR      RR
  0xF0,0xF3,0xCC      // XXXXXXXX  XX  XX  XXRR  RR  RR  RRRRRRRR
];

// prettier-ignore
const roomGfxBlueMazeBottom = [
  0xF0,0xF3,0x0C,     // XXXXXXXX  XX  XX        RR  RR  RRRRRRRR
  0x00,0x30,0x0C,     //       XX      XX        RR      RR
  0xF0,0x3F,0x0F,     // XXXX  XXXXXXXXXX        RRRRRRRRRR  RRRR
  0xF0,0x00,0x00,     // XXXX                                RRRR
  0xF0,0xF0,0x00,     // XXXXXXXX                        RRRRRRRR
  0x00,0x30,0x00,     //       XX                        RR
  0xF0,0xFF,0xFF      // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxBlueMazeCenter = [
  0xF0,0x33,0x3F,     // XXXX  XX  XXXXXXXX    RRRRRRRR  RR  RRRR
  0x00,0x30,0x3C,     //       XX      XXXX    RRRR      RR
  0xF0,0xFF,0x3C,     // XXXXXXXXXXXX  XXXX    RRRR  RRRRRRRRRRRR
  0x00,0x03,0x3C,     //           XX  XXXX    RRRR  RR
  0xF0,0x33,0x3C,     // XXXX  XX  XX  XXXX    RRRR  RR  RR  RRRR
  0x00,0x33,0x0C,     //       XX  XX  XX        RR  RR  RR
  0xF0,0xF3,0x0C      // XXXXXXXX  XX  XX        RR  RR  RRRRRRRR
];

// prettier-ignore
const roomGfxBlueMazeEntry = [
  0xF0,0xF3,0xCC,     // XXXXXXXX  XX  XX  XXRR  RR  RR  RRRRRRRR
  0x00,0x33,0x0C,     //       XX  XX  XX        RR  RR  RR
  0xF0,0x33,0xFC,     // XXXX  XX  XX  XXXXXXRRRRRR  RR  RR  RRRR
  0x00,0x33,0x00,     //       XX  XX                RR  RR
  0xF0,0xF3,0xFF,     // XXXXXXXX  XXXXXXXXXXRRRRRRRRRR  RRRRRRRR
  0x00,0x00,0x00,
  0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxMazeMiddle = [
  0xF0,0xFF,0xCC,     // XXXXXXXXXXXX  XX  XXRR  RR  RRRRRRRRRRRR
  0x00,0x00,0xCC,     //               XX  XXRR  RR
  0xF0,0x03,0xCF,     // XXXX      XXXXXX  XXRR  RRRRRR      RRRR
  0x00,0x03,0x00,     //           XX                RR
  0xF0,0xF3,0xFC,     // XXXXXXXX  XX  XXXXXXRRRRRR  RR  RRRRRRRR
  0x00,0x33,0x0C,     //       XX  XX  XX        RR  RR  RR
  0xF0,0x33,0xCC      // XXXX  XX  XX  XX  XXRR  RR  RR  RR  RRRR
];

// prettier-ignore
const roomGfxMazeEntry = [
  0xF0,0xFF,0x0F,     // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x00,0x30,0x00,     //       XX                        RR
  0xF0,0x30,0xFF,     // XXXX  XX    XXXXXXXXRRRRRRRRR   RR  RRRR
  0x00,0x30,0xC0,     //       XX          XXRR          RR
  0xF0,0xF3,0xC0,     // XXXXXXXX  XX      XXRR      RR  RRRRRRRR
  0x00,0x03,0xC0,     //           XX      XXRR      RR
  0xF0,0xFF,0xCC      // XXXXXXXXXXXX  XX  XXRR  RR  RRRRRRRRRRRR
];

// prettier-ignore
const roomGfxMazeSide = [
  0xF0,0x33,0xCC,     // XXXX  XX  XX  XX  XXRR  RR  RR  RR  RRRR
  0x00,0x30,0xCC,     //       XX      XX  XXRR  RR      RR
  0x00,0x3F,0xCF,     //       XXXXXX  XX  XXRR  RR  RRRRRR
  0x00,0x00,0xC0,     //                   XXRR
  0x00,0x3F,0xC3,     //       XXXXXXXX    XXRR    RRRRRRRR
  0x00,0x30,0xC0,     //       XX          XXRR          RR
  0xF0,0xFF,0xFF      // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxSideCorridor = [
  0xF0,0xFF,0x0F,     // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0x00,0x00,0x00,
  0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxTopEntryRoom = [
  0xF0,0xFF,0x0F,    // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x30,0x00,0x00,    // XX                                    RR
  0x30,0x00,0x00,    // XX                                    RR
  0x30,0x00,0x00,    // XX                                    RR
  0x30,0x00,0x00,    // XX                                    RR
  0x30,0x00,0x00,    // XX                                    RR
  0xF0,0xFF,0xFF     // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxCastle = [
  0xF0,0xFE,0x15,     // XXXXXXXXXXX X X X      R R R RRRRRRRRRRR
  0x30,0x03,0x1F,     // XX        XXXXXXX      RRRRRRR        RR
  0x30,0x03,0xFF,     // XX        XXXXXXXXXXRRRRRRRRRR        RR
  0x30,0x00,0xFF,     // XX          XXXXXXXXRRRRRRRR          RR
  0x30,0x00,0x3F,     // XX          XXXXXX    RRRRRR          RR
  0x30,0x00,0x00,     // XX                                    RR
  0xF0,0xFF,0x0F      // XXXXXXXXXXXXXX            RRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxBlackMaze1 = [
  0xF0,0xF0,0xFF,    // XXXXXXXX    XXXXXXXXRRRRRRRR    RRRRRRRR
  0x00,0x00,0x03,    //             XX            RR
  0xF0,0xFF,0x03,    // XXXXXXXXXXXXXX            RRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0x30,0x3F,0xFF,    // XX    XXXXXXXXXXXXXXRRRRRRRRRRRRRR    RR
  0x00,0x30,0x00,    //       XX                        RR
  0xF0,0xF0,0xFF     // XXXXXXXX    XXXXXXXXRRRRRRRR    RRRRRRRR
];

// prettier-ignore
const roomGfxBlackMaze3 = [
  0xF0,0xF0,0xFF,    // XXXXXXXX    XXXXXXXXRRRRRRRR    RRRRRRRR
  0x30,0x00,0x00,    // XX                  MM
  0x30,0x3F,0xFF,    // XX    XXXXXXXXXXXXXXMM    MMMMMMMMMMMMMM
  0x00,0x30,0x00,    //       XX                  MM
  0xF0,0xF0,0xFF,    // XXXXXXXX    XXXXXXXXMMMMMMMM    MMMMMMMM
  0x30,0x00,0x03,    // XX          XX      MM          MM
  0xF0,0xF0,0xFF     // XXXXXXXX    XXXXXXXXMMMMMMMM    MMMMMMMM
];

// prettier-ignore
const roomGfxBlackMaze2 = [
  0xF0,0xFF,0xFF,    // XXXXXXXXXXXXXXXXXXXXMMMMMMMMMMMMMMMMMMMM
  0x00,0x00,0xC0,    //                   XX                  MM
  0xF0,0xFF,0xCF,    // XXXXXXXXXXXXXXXX  XXMMMMMMMMMMMMMMMM  MM
  0x00,0x00,0x0C,    //                   XX                  MM
  0xF0,0x0F,0xFF,    // XXXX    XXXXXXXXXXXXMMMM    MMMMMMMMMMMM
  0x00,0x0F,0xC0,    //         XXXX      XX        MMMM      MM
  0x30,0xCF,0xCC     // XX  XX  XXXX  XX  XXMM  MM  MMMM  MM  MM
];

// prettier-ignore
const roomGfxBlackMazeEntry = [
  0x30,0xCF,0xCC,    // XX  XX  XXXX  XX  XXMM  MM  MMMM  MM  MM
  0x00,0xC0,0xCC,    //         XX        XX  XXRR  RR        RR
  0xF0,0xFF,0x0F,    // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0xF0,0xFF,0x0F,    // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0xF0,0xFF,0x0F     // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxRedMaze1 = [
  0xF0,0xFF,0xFF,    // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
  0x00,0x00,0x00,
  0xF0,0xFF,0x0F,    // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x00,0x00,0x0C,    //                   XX        RR
  0xF0,0xFF,0x0C,    // XXXXXXXXXXXX  XX        RR  RRRRRRRRRRRR
  0xF0,0x03,0xCC,    // XXXX      XX  XX  XXRR  RR  RR      RRRR
  0xF0,0x33,0xCF     // XXXX  XX  XXXXXX  XXRR  RRRRRR  RR  RRRR
];

// prettier-ignore
const roomGfxRedMazeTop = [
  0xF0,0xFF,0xFF,     // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
  0x00,0x00,0xC0,     //                   XXRR
  0xF0,0xFF,0xCF,     // XXXXXXXXXXXXXXXX  XXRR  RRRRRRRRRRRRRRRR
  0x00,0x00,0xCC,     //               XX  XXRR  RR
  0xF0,0x33,0xFF,     // XXXX  XX  XXXXXXXXXXRRRRRRRRRR  RR  RRRR
  0xF0,0x33,0x00,     // XXXX  XX  XX                RR  RR  RRRR
  0xF0,0x3F,0x0C      // XXXX  XXXXXX  XX        RR  RRRRRR  RRRR
];

// prettier-ignore
const roomGfxRedMazeBottom = [
  0xF0,0x33,0xCF,     // XXXX  XX  XXXXXX  XXRR  RRRRRR  RR  RRRR
  0xF0,0x30,0x00,     // XXXX  XX                        RR  RRRR
  0xF0,0x33,0xFF,     // XXXX  XX  XXXXXXXXXXRRRRRRRRRR  RR  RRRR
  0x00,0x33,0x00,     //       XX  XX                RR  RR  RRRR
  0xF0,0xFF,0x00,     // XXXXXXXXXXXX                RRRRRRRRRRRR
  0x00,0x00,0x00,
  0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxWhiteCastleEntry = [
  0xF0,0x3F,0x0C,     // XXXX  XXXXXX  XX        RR  RRRRRR  RRRR
  0xF0,0x00,0x0C,     // XXXX          XX        RR          RRRR
  0xF0,0xFF,0x0F,     // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x00,0x30,0x00,     //       XX                        RR
  0xF0,0x30,0x00,     // XXXX  XX                        RR  RRRR
  0x00,0x30,0x00,     //       XX                        RR
  0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
];

// prettier-ignore
const roomGfxTwoExitRoom = [
  0xF0,0xFF,0x0F,     // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
  0x30,0x00,0x00,     // XX                                    RR
  0x30,0x00,0x00,     // XX                                    RR
  0x30,0x00,0x00,     // XX                                    RR
  0x30,0x00,0x00,     // XX                                    RR
  0x30,0x00,0x00,     // XX                                    RR
  0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXX        RRRRRRRRRRRRRRRR
];

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
  {
    graphicsData: roomGfxBelowYellowCastle,
    flags: ROOMFLAG_LEFTTHINWALL,
    color: COLOR_OLIVEGREEN,
    roomUp: 0x08,
    roomRight: 0x02,
    roomDown: 0x80,
    roomLeft: 0x03,
  }, // 1 - Top Access
  {
    graphicsData: roomGfxBelowYellowCastle,
    flags: ROOMFLAG_NONE,
    color: COLOR_LIMEGREEN,
    roomUp: 0x11,
    roomRight: 0x03,
    roomDown: 0x83,
    roomLeft: 0x01,
  }, // 2 - Top Access
  {
    graphicsData: roomGfxLeftOfName,
    flags: ROOMFLAG_RIGHTTHINWALL,
    color: COLOR_TAN,
    roomUp: 0x06,
    roomRight: 0x01,
    roomDown: 0x86,
    roomLeft: 0x02,
  }, // 3 - Left of Name
  {
    graphicsData: roomGfxBlueMazeTop,
    flags: ROOMFLAG_NONE,
    color: COLOR_BLUE,
    roomUp: 0x10,
    roomRight: 0x05,
    roomDown: 0x07,
    roomLeft: 0x06,
  }, // 4 - Top of Blue Maze
  {
    graphicsData: roomGfxBlueMaze1,
    flags: ROOMFLAG_NONE,
    color: COLOR_BLUE,
    roomUp: 0x1d,
    roomRight: 0x06,
    roomDown: 0x08,
    roomLeft: 0x04,
  }, // 5 - Blue Maze #1
  {
    graphicsData: roomGfxBlueMazeBottom,
    flags: ROOMFLAG_NONE,
    color: COLOR_BLUE,
    roomUp: 0x07,
    roomRight: 0x04,
    roomDown: 0x03,
    roomLeft: 0x05,
  }, // 6 - Bottom of Blue Maze
  {
    graphicsData: roomGfxBlueMazeCenter,
    flags: ROOMFLAG_NONE,
    color: COLOR_BLUE,
    roomUp: 0x04,
    roomRight: 0x08,
    roomDown: 0x06,
    roomLeft: 0x08,
  }, // 7 - Center of Blue Maze
  {
    graphicsData: roomGfxBlueMazeEntry,
    flags: ROOMFLAG_NONE,
    color: COLOR_BLUE,
    roomUp: 0x05,
    roomRight: 0x07,
    roomDown: 0x01,
    roomLeft: 0x07,
  }, // 8 - Blue Maze Entry
  {
    graphicsData: roomGfxMazeMiddle,
    flags: ROOMFLAG_NONE,
    color: COLOR_LTGRAY,
    roomUp: 0x0a,
    roomRight: 0x0a,
    roomDown: 0x0b,
    roomLeft: 0x0a,
  }, // 9 - Maze Middle
  {
    graphicsData: roomGfxMazeEntry,
    flags: ROOMFLAG_NONE,
    color: COLOR_LTGRAY,
    roomUp: 0x03,
    roomRight: 0x09,
    roomDown: 0x09,
    roomLeft: 0x09,
  }, // A - Maze Entry
  {
    graphicsData: roomGfxMazeSide,
    flags: ROOMFLAG_NONE,
    color: COLOR_LTGRAY,
    roomUp: 0x09,
    roomRight: 0x0c,
    roomDown: 0x1c,
    roomLeft: 0x0d,
  }, // B - Maze Side
  {
    graphicsData: roomGfxSideCorridor,
    flags: ROOMFLAG_RIGHTTHINWALL,
    color: COLOR_LTCYAN,
    roomUp: 0x1c,
    roomRight: 0x0d,
    roomDown: 0x1d,
    roomLeft: 0x0b,
  }, // C - Side Corridor
  {
    graphicsData: roomGfxSideCorridor,
    flags: ROOMFLAG_LEFTTHINWALL,
    color: COLOR_DKGREEN,
    roomUp: 0x0f,
    roomRight: 0x0b,
    roomDown: 0x0e,
    roomLeft: 0x0c,
  }, // D - Side Corridor
  {
    graphicsData: roomGfxTopEntryRoom,
    flags: ROOMFLAG_NONE,
    color: COLOR_CYAN,
    roomUp: 0x0d,
    roomRight: 0x10,
    roomDown: 0x0f,
    roomLeft: 0x10,
  }, // E - Top Entry Room
  {
    graphicsData: roomGfxCastle,
    flags: ROOMFLAG_NONE,
    color: COLOR_WHITE,
    roomUp: 0x0e,
    roomRight: 0x0f,
    roomDown: 0x0d,
    roomLeft: 0x0f,
  }, // F - White Castle
  {
    graphicsData: roomGfxCastle,
    flags: ROOMFLAG_NONE,
    color: COLOR_BLACK,
    roomUp: 0x01,
    roomRight: 0x1c,
    roomDown: 0x04,
    roomLeft: 0x1c,
  }, // 10 - Black Castle
  {
    graphicsData: roomGfxCastle,
    flags: ROOMFLAG_NONE,
    color: COLOR_YELLOW,
    roomUp: 0x06,
    roomRight: 0x03,
    roomDown: 0x02,
    roomLeft: 0x01,
  }, // 11 - Yellow Castle
  {
    graphicsData: roomGfxNumberRoom,
    flags: ROOMFLAG_NONE,
    color: COLOR_YELLOW,
    roomUp: 0x12,
    roomRight: 0x12,
    roomDown: 0x12,
    roomLeft: 0x12,
  }, // 12 - Yellow Castle Entry
  {
    graphicsData: roomGfxBlackMaze1,
    flags: ROOMFLAG_NONE,
    color: COLOR_LTGRAY,
    roomUp: 0x15,
    roomRight: 0x14,
    roomDown: 0x15,
    roomLeft: 0x16,
  }, // 13 - Black Maze #1
  {
    graphicsData: roomGfxBlackMaze2,
    flags: ROOMFLAG_MIRROR,
    color: COLOR_LTGRAY,
    roomUp: 0x16,
    roomRight: 0x15,
    roomDown: 0x16,
    roomLeft: 0x13,
  }, // 14 - Black Maze #2
  {
    graphicsData: roomGfxBlackMaze3,
    flags: ROOMFLAG_MIRROR,
    color: COLOR_LTGRAY,
    roomUp: 0x13,
    roomRight: 0x16,
    roomDown: 0x13,
    roomLeft: 0x14,
  }, // 15 - Black Maze #3
  {
    graphicsData: roomGfxBlackMazeEntry,
    flags: ROOMFLAG_NONE,
    color: COLOR_LTGRAY,
    roomUp: 0x14,
    roomRight: 0x13,
    roomDown: 0x1b,
    roomLeft: 0x15,
  }, // 16 - Black Maze Entry
  {
    graphicsData: roomGfxRedMaze1,
    flags: ROOMFLAG_NONE,
    color: COLOR_RED,
    roomUp: 0x19,
    roomRight: 0x18,
    roomDown: 0x19,
    roomLeft: 0x18,
  }, // 17 - Red Maze #1
  {
    graphicsData: roomGfxRedMazeTop,
    flags: ROOMFLAG_NONE,
    color: COLOR_RED,
    roomUp: 0x1a,
    roomRight: 0x17,
    roomDown: 0x1a,
    roomLeft: 0x17,
  }, // 18 - Top of Red Maze
  {
    graphicsData: roomGfxRedMazeBottom,
    flags: ROOMFLAG_NONE,
    color: COLOR_RED,
    roomUp: 0x17,
    roomRight: 0x1a,
    roomDown: 0x17,
    roomLeft: 0x1a,
  }, // 19 - Bottom of Red Maze
  {
    graphicsData: roomGfxWhiteCastleEntry,
    flags: ROOMFLAG_NONE,
    color: COLOR_RED,
    roomUp: 0x18,
    roomRight: 0x19,
    roomDown: 0x18,
    roomLeft: 0x19,
  }, // 1A - White Castle Entry
  {
    graphicsData: roomGfxTwoExitRoom,
    flags: ROOMFLAG_NONE,
    color: COLOR_RED,
    roomUp: 0x89,
    roomRight: 0x89,
    roomDown: 0x89,
    roomLeft: 0x89,
  }, // 1B - Black Castle Entry
  {
    graphicsData: roomGfxNumberRoom,
    flags: ROOMFLAG_NONE,
    color: COLOR_PURPLE,
    roomUp: 0x1d,
    roomRight: 0x07,
    roomDown: 0x8c,
    roomLeft: 0x08,
  }, // 1C - Other Purple Room
  {
    graphicsData: roomGfxTopEntryRoom,
    flags: ROOMFLAG_NONE,
    color: COLOR_RED,
    roomUp: 0x8f,
    roomRight: 0x01,
    roomDown: 0x10,
    roomLeft: 0x03,
  }, // 1D - Top Entry Room
  {
    graphicsData: roomGfxBelowYellowCastle,
    flags: ROOMFLAG_NONE,
    color: COLOR_PURPLE,
    roomUp: 0x06,
    roomRight: 0x01,
    roomDown: 0x06,
    roomLeft: 0x03,
  }, // 1E - Name Room
];

// Room placement bounds for game 3 random object placement
// Format per entry: objectId, lowerRoomBound, upperRoomBound
// Terminated by ObjectId.None sentinel
// prettier-ignore
export const roomBoundsData = [
  ObjectId.Chalice,      0x13, 0x1A,
  ObjectId.RedDragon,    0x01, 0x1D,
  ObjectId.YellowDragon, 0x01, 0x1D,
  ObjectId.GreenDragon,  0x01, 0x1D,
  ObjectId.Sword,        0x01, 0x1D,
  ObjectId.Bridge,       0x01, 0x1D,
  ObjectId.YellowKey,    0x01, 0x1D,
  ObjectId.WhiteKey,     0x01, 0x16,
  ObjectId.BlackKey,     0x01, 0x12,
  ObjectId.Bat,          0x01, 0x1D,
  ObjectId.Magnet,       0x01, 0x1D,
  ObjectId.None,         0,    0
]

// Room differences for different levels (level 1,2,3)
// prettier-ignore
export const roomLevelDiffs = [
  0x10,0x0f,0x0f, // down from room 01
  0x05,0x11,0x11, // down from room 02
  0x1d,0x0a,0x0a, // down from room 03
  0x1c,0x16,0x16, // u/l/r/d from room 1b (black castle room)
  0x1b,0x0c,0x0c, // down from room 1c
  0x03,0x0c,0x0c // up from room 1d (top entry room)
];

// Castle Rooms (Yellow, White, Black)
export const castleRoomOffsets = [0x11, 0x0f, 0x10];

// Castle Entry Rooms (Yellow, White, Black)
export const entryRoomOffsets = [0x12, 0x1a, 0x1b];
