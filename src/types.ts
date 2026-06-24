export interface JOYSTICK {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

export const GameState = {
  GameSelect: 0,
  Active1: 1,
  Active2: 2,
  Active3: 3,
  Win: 4,
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

export const ObjectId = {
  RightWall: -5,
  LeftWall: -4,
  Surround: -3,
  Ball: -2,
  None: -1,
  Port1: 0,
  Port2: 1,
  Port3: 2,
  Name: 3,
  Number: 4,
  RedDragon: 5,
  YellowDragon: 6,
  GreenDragon: 7,
  Sword: 8,
  Bridge: 9,
  YellowKey: 10,
  WhiteKey: 11,
  BlackKey: 12,
  Bat: 13,
  Dot: 14,
  Chalice: 15,
  Magnet: 16,
} as const;

export interface ROOM {
  graphicsData: number[];
  flags: number;
  color: number;
  roomUp: number;
  roomRight: number;
  roomDown: number;
  roomLeft: number;
}

export interface OBJECT {
  graphicsData: number[] | null;
  states: number[];
  state: number;
  color: number;
  room: number;
  x: number;
  y: number;
  movementX: number;
  movementY: number;
  size: number;
  linkedObject: number;
  linkedObjectX: number;
  linkedObjectY: number;
  displayed: boolean;
}

export interface BALL {
  room: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  linkedObject: number;
  linkedObjectX: number;
  linkedObjectY: number;
  hitX: boolean;
  hitY: boolean;
  hitObject: number;
}
