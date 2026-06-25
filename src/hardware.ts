// Hardware abstraction layer.

import { FPS, OVERSCAN } from "./constants";
import type { COLOR } from "./data/colors";
import type { JOYSTICK } from "./types";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

let keyReset: boolean = false;
let keySelect: boolean = false;
let keyLeft: boolean = false;
let keyRight: boolean = false;
let keyUp: boolean = false;
let keyDown: boolean = false;
let keyFire: boolean = false;

let lastColor: COLOR = { r: 0, g: 0, b: 0 };
let colorChangeCallback: (color: COLOR) => void;

export function run(tick: () => void, onColorChange: (color: COLOR) => void): void {
  colorChangeCallback = onColorChange;

  // SETUP: GAME SURFACE

  canvas = document.getElementById("canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;

  // The Atari 2600 renders bottom-up: y=0 at the bottom of the
  // screen and increases upward. The HTML canvas is top-down:
  // y=0 is at the top and increases downward. The transform
  // statement applies a 2D matrix. The goal is to scale y by
  // -1 (flipping the axis) and then translate by the height of
  // the canvas to shift the origin back into view. All game
  // draw calls can then use Atari coordinates directly without
  // a per-call adjustment.
  ctx.transform(1, 0, 0, -1, 0, canvas.height);

  // SETUP: GAME ACTIONS
  setupKeyHandlers();

  // SETUP: GAME INTERFACE

  const frameInterval = 1000 / FPS;
  let lastTimestamp = 0;

  function gameLoop(timestamp: number): void {
    if (timestamp - lastTimestamp >= frameInterval) {
      lastTimestamp += frameInterval;
      tick();
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

export function paintPixel(
  r: number,
  g: number,
  b: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  width = width || 1;
  height = height || 1;
  ctx.fillStyle = `rgba(${r},${g},${b},1)`;
  ctx.fillRect(x, y - OVERSCAN, width, height);
}

export function roomColor(color: COLOR): void {
  if (color.r !== lastColor.r || color.g !== lastColor.g || color.b !== lastColor.b) {
    lastColor = color;
    colorChangeCallback(color);
  }
}

export function readResetSwitch(): boolean {
  return keyReset;
}

export function readSelectSwitch(): boolean {
  return keySelect;
}

export function readJoystick(joystick: JOYSTICK): void {
  joystick.left = keyLeft;
  joystick.up = keyUp;
  joystick.right = keyRight;
  joystick.down = keyDown;
  joystick.fire = keyFire;
}

export function random(): number {
  return Math.random();
}

function applyKeyState(key: string, pressed: boolean): void {
  switch (key) {
    case "1":
      keyReset = pressed;
      break;
    case "2":
      keySelect = pressed;
      break;
    case "ArrowUp":
      keyUp = pressed;
      break;
    case "ArrowDown":
      keyDown = pressed;
      break;
    case "ArrowLeft":
      keyLeft = pressed;
      break;
    case "ArrowRight":
      keyRight = pressed;
      break;
    case " ":
      keyFire = pressed;
      break;
  }
}

function setupKeyHandlers(): void {
  window.onkeydown = (e: KeyboardEvent): void => applyKeyState(e.key, true);
  window.onkeyup = (e: KeyboardEvent): void => applyKeyState(e.key, false);
}
