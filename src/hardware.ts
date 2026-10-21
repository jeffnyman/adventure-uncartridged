// Hardware abstraction layer.

import {
  soundDragonDie,
  soundEaten,
  soundPickUp,
  soundPutDown,
  soundRoar,
  soundWon,
} from "./audio";
import { FPS, OVERSCAN } from "./constants";
import type { COLOR } from "./data/colors";
import { Difficulty, type JOYSTICK, Sound, type SWITCHES } from "./types";

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

// Difficulty B (the amateur setting) was the hardware default on
// the original 2600. When the left difficulty switch is in the B
// position, the Dragons will hesitate before they bite the player.
// If the right difficulty switch is in the B position all Dragons
// will run from the sword.
let difficultyLeft: Difficulty = Difficulty.B;
let difficultyRight: Difficulty = Difficulty.B;

// Playback of a recorded input file. Each entry holds one frame's
// input as bits: up 1, down 2, left 4, right 8, fire 16, reset 32,
// select 64. Inputs are applied per game frame rather than per
// unit of time, so a playback always reproduces the recorded game
// exactly, whatever the display's refresh rate.
let playbackFrames: number[] | null = null;
let playbackIndex = 0;
let playbackResync = false;
let playbackDone: (() => void) | null = null;

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
    if (playbackResync) {
      lastTimestamp = timestamp;
      playbackResync = false;
    }

    if (timestamp - lastTimestamp >= frameInterval) {
      lastTimestamp += frameInterval;
      applyPlaybackFrame();
      tick();
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

export function playSound(sound: Sound): void {
  switch (sound) {
    case Sound.Won:
      void soundWon.play();
      break;
    case Sound.Roar:
      if (soundRoar.paused) {
        void soundRoar.play();
      }
      break;
    case Sound.Eaten:
      void soundEaten.play();
      break;
    case Sound.DragonDie:
      // The roar must be cut before playing the death sound, which
      // mirrors the original hardware where the dragon's roar stops
      // the moment it dies.
      soundRoar.pause();
      soundRoar.currentTime = 0;
      soundDragonDie.currentTime = 0;
      void soundDragonDie.play();
      break;
    case Sound.PutDown:
      soundPutDown.currentTime = 0;
      void soundPutDown.play();
      break;
    case Sound.PickUp:
      soundPickUp.currentTime = 0;
      void soundPickUp.play();
      break;
  }
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

  // Subtracting OVERSCAN is necessary here so that the game
  // y-coordinates map into the visible screen area after the
  // y-flip transform. The canvas height includes the overscan
  // regions, so without this shift game objects would be drawn
  // into the border.
  ctx.fillRect(x, y - OVERSCAN, width, height);
}

export function roomColor(color: COLOR): void {
  // roomColor may be called every frame even when the room hasn't
  // changed. The callback is skipped when the color is identical
  // to avoid unncessary updates. Field comparison is required
  // becuase the color argument may be a freshly constructed object
  // each call, so reference equality would always fail.
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

export function readDifficultySwitches(): SWITCHES {
  return { left: difficultyLeft, right: difficultyRight };
}

export function toggleDifficultyLeft(): "A" | "B" {
  difficultyLeft = difficultyLeft === Difficulty.A ? Difficulty.B : Difficulty.A;
  return difficultyLeft === Difficulty.A ? "A" : "B";
}

export function toggleDifficultyRight(): "A" | "B" {
  difficultyRight = difficultyRight === Difficulty.A ? Difficulty.B : Difficulty.A;
  return difficultyRight === Difficulty.A ? "A" : "B";
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

export function startPlayback(
  frames: number[],
  left: "A" | "B",
  right: "A" | "B",
  onDone: () => void,
): void {
  difficultyLeft = left === "A" ? Difficulty.A : Difficulty.B;
  difficultyRight = right === "A" ? Difficulty.A : Difficulty.B;
  playbackFrames = frames;
  playbackIndex = 0;
  playbackResync = true;
  playbackDone = onDone;
}

function applyPlaybackFrame(): void {
  if (!playbackFrames) return;

  if (playbackIndex >= playbackFrames.length) {
    playbackFrames = null;
    keyUp = keyDown = keyLeft = keyRight = keyFire = keyReset = keySelect = false;
    playbackDone?.();
    return;
  }

  const bits = playbackFrames[playbackIndex++];
  keyUp = (bits & 1) !== 0;
  keyDown = (bits & 2) !== 0;
  keyLeft = (bits & 4) !== 0;
  keyRight = (bits & 8) !== 0;
  keyFire = (bits & 16) !== 0;
  keyReset = (bits & 32) !== 0;
  keySelect = (bits & 64) !== 0;
}

function applyKeyState(key: string, pressed: boolean): void {
  // The keyboard is ignored while a recording plays back.
  if (playbackFrames) return;

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
