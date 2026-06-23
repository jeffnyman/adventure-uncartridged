import "./style.css";
import { audit } from "./utils/logger";
import { run } from "./hardware";
import { startGame } from "./adventure";
import type { COLOR } from "./data/colors";

document.documentElement.classList.replace("no-js", "js");

audit(import.meta.env.VITE_APP_TITLE);

const body = document.querySelector("body");

function onRoomColorChange(color: COLOR): void {
  if (body) {
    body.style.setProperty("--game-text", `rgba(${color.r},${color.g},${color.b},1)`);
  }
}

run(startGame, onRoomColorChange);
