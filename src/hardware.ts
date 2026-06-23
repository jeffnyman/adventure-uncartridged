// Hardware abstraction layer.

import { FPS } from "./constants";

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

export function run(tick: () => void): void {
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
