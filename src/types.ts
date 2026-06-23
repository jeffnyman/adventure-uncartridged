export const GameState = {
  GameSelect: 0,
  Active1: 1,
  Active2: 2,
  Active3: 3,
  Win: 4,
} as const;

export const ObjectId = {
  None: -1,
  Number: 0,
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

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
