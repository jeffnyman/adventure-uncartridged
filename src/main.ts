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
const btnFullScreen = document.querySelector<HTMLButtonElement>("#btn-fullscreen");

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

if (btnFullScreen && body) {
  btnFullScreen.onclick = (): void => {
    const entering = body.classList.toggle("fullscreen");
    btnFullScreen.textContent = entering ? "Exit Full Screen" : "Full Screen";
  };

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("fullscreen")) {
      body.classList.remove("fullscreen");
      btnFullScreen.textContent = "Full Screen";
    }
  });
}

function onRoomColorChange(color: COLOR): void {
  if (body) {
    body.style.setProperty("--game-text", `rgba(${color.r},${color.g},${color.b},1)`);
  }
}

run(startGame, onRoomColorChange);
