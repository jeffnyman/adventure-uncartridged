import "./style.css";
import { audit } from "./utils/logger";
import { run, toggleDifficultyLeft, toggleDifficultyRight } from "./hardware";
import { startGame } from "./adventure";
import type { COLOR } from "./data/colors";

document.documentElement.classList.replace("no-js", "js");

audit(import.meta.env.VITE_APP_TITLE);

const body = document.querySelector("body");

const btnLeftDiff = document.querySelector<HTMLButtonElement>("#btn-left-difficulty");
const btnRightDiff = document.querySelector<HTMLButtonElement>("#btn-right-difficulty");

if (btnLeftDiff) {
  btnLeftDiff.onclick = (): void => {
    const label = toggleDifficultyLeft();
    btnLeftDiff.textContent = `Left: ${label}`;
    btnLeftDiff.classList.toggle("difficulty-active", label === "A");
  };
}

if (btnRightDiff) {
  btnRightDiff.onclick = (): void => {
    const label = toggleDifficultyRight();
    btnRightDiff.textContent = `Right: ${label}`;
    btnRightDiff.classList.toggle("difficulty-active", label === "A");
  };
}

function onRoomColorChange(color: COLOR): void {
  if (body) {
    body.style.setProperty("--game-text", `rgba(${color.r},${color.g},${color.b},1)`);
  }
}

run(startGame, onRoomColorChange);
