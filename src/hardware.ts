// Hardware abstraction layer.

import { FPS } from "./constants";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

let keyReset: boolean = false;
let keySelect: boolean = false;

export function run(tick: () => void): void {
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
      lastTimestamp = timestamp;
      tick();
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

export function readResetSwitch(): boolean {
  return keyReset;
}

export function readSelectSwitch(): boolean {
  return keySelect;
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
      // handle up movement
      break;
    case "ArrowDown":
      // handle down movement
      break;
    case "ArrowLeft":
      // handle left movement
      break;
    case "ArrowRight":
      // handle right movement
      break;
    case " ":
      // handle drop action
      break;
  }
}

function setupKeyHandlers(): void {
  window.onkeydown = (e) => applyKeyState(e.key, true);
  window.onkeyup = (e) => applyKeyState(e.key, false);
}
