// Hardware abstraction layer.

import { FPS } from "./constants";

export function run(tick: () => void): void {
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
