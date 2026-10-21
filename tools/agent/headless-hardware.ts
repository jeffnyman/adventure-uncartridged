// Headless stand-in for src/hardware.ts.
//
// It exports the same functions the game imports, but reads input
// from a value the harness sets each frame instead of the keyboard,
// draws into an in-memory frame buffer instead of a canvas, and
// records sounds instead of playing them.

import { OVERSCAN, SCREEN_HEIGHT, SCREEN_WIDTH } from "../../src/constants.ts";
import type { COLOR } from "../../src/data/colors.ts";
import { Difficulty, type JOYSTICK, type SWITCHES } from "../../src/types.ts";

export interface Input {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  fire?: boolean;
  reset?: boolean;
  select?: boolean;
}

let input: Input = {};
let difficultyLeft: number = Difficulty.B;
let difficultyRight: number = Difficulty.B;

let drawing = false;

export const sounds: number[] = [];

// Painting every pixel is the slowest part of a frame, so it is
// off unless a caller needs the picture.
export function setDrawing(on: boolean): void {
  drawing = on;
}
export const frame = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT * 3);

export function setInput(next: Input): void {
  input = next;
}

export function setDifficulty(left: "A" | "B", right: "A" | "B"): void {
  difficultyLeft = left === "A" ? Difficulty.A : Difficulty.B;
  difficultyRight = right === "A" ? Difficulty.A : Difficulty.B;
}

export function playSound(sound: number): void {
  sounds.push(sound);
}

// Mirrors the canvas transform in src/hardware.ts: game y runs
// upward from the bottom, and is shifted down by the overscan.
export function paintPixel(
  r: number,
  g: number,
  b: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (!drawing) return;
  width = width || 1;
  height = height || 1;
  const top = y - OVERSCAN;

  for (let py = top; py < top + height; py++) {
    const row = SCREEN_HEIGHT - 1 - py;
    if (row < 0 || row >= SCREEN_HEIGHT) continue;

    for (let px = x; px < x + width; px++) {
      if (px < 0 || px >= SCREEN_WIDTH) continue;
      const i = (row * SCREEN_WIDTH + px) * 3;
      frame[i] = r;
      frame[i + 1] = g;
      frame[i + 2] = b;
    }
  }
}

export function roomColor(_color: COLOR): void {}

export function readResetSwitch(): boolean {
  return input.reset ?? false;
}

export function readSelectSwitch(): boolean {
  return input.select ?? false;
}

export function readDifficultySwitches(): SWITCHES {
  return { left: difficultyLeft as Difficulty, right: difficultyRight as Difficulty };
}

export function readJoystick(joystick: JOYSTICK): void {
  joystick.left = input.left ?? false;
  joystick.up = input.up ?? false;
  joystick.right = input.right ?? false;
  joystick.down = input.down ?? false;
  joystick.fire = input.fire ?? false;
}

// Games 1 and 2 never call this. Game 3 is out of scope here.
export function random(): number {
  return 0;
}
