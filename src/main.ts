import "./style.css";
import { audit } from "./utils/logger";
import { run, startPlayback, toggleDifficultyLeft, toggleDifficultyRight } from "./hardware";
import { startGame } from "./adventure";
import type { COLOR } from "./data/colors";

document.documentElement.classList.replace("no-js", "js");

audit(import.meta.env.VITE_APP_TITLE);

const body = document.querySelector("body");
const toast = document.querySelector<HTMLDivElement>("#toast");
const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);

function showToast(message: string): void {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("showing");
  void toast.offsetWidth;
  toast.classList.add("showing");

  toast.addEventListener("animationend", () => toast.classList.remove("showing"), { once: true });
}

const btnLeftDiff = document.querySelector<HTMLButtonElement>("#btn-left-difficulty");
const btnRightDiff = document.querySelector<HTMLButtonElement>("#btn-right-difficulty");
const btnFullScreen = document.querySelector<HTMLButtonElement>("#btn-fullscreen");

if (btnLeftDiff) {
  btnLeftDiff.onclick = (): void => {
    const label = toggleDifficultyLeft();

    btnLeftDiff.textContent = `Left: ${label}`;
    btnLeftDiff.classList.toggle("difficulty-active", label === "A");
    btnLeftDiff.blur();
  };
}

if (btnRightDiff) {
  btnRightDiff.onclick = (): void => {
    const label = toggleDifficultyRight();

    btnRightDiff.textContent = `Right: ${label}`;
    btnRightDiff.classList.toggle("difficulty-active", label === "A");
    btnRightDiff.blur();
  };
}

if (btnFullScreen && body) {
  btnFullScreen.onclick = (): void => {
    const entering = body.classList.toggle("fullscreen");

    btnFullScreen.textContent = entering ? "Exit Full Screen" : "Full Screen";

    if (entering) {
      showToast("Press Escape to exit full screen");
    } else {
      if (toast) {
        toast.classList.remove("showing");
      }
    }
  };

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("fullscreen")) {
      body.classList.remove("fullscreen");
      btnFullScreen.textContent = "Full Screen";

      if (toast) {
        toast.classList.remove("showing");
      }
    }

    if (GAME_KEYS.has(e.key)) {
      body.classList.add("hide-cursor");
    }
  });

  window.addEventListener("mousemove", () => body.classList.remove("hide-cursor"));
}

function onRoomColorChange(color: COLOR): void {
  if (body) {
    body.style.setProperty("--game-text", `rgba(${color.r},${color.g},${color.b},1)`);
  }
}

run(startGame, onRoomColorChange);

// Optional playback of a recorded game: ?replay=<url of a JSON file>
// holding { difficulty: { left, right }, frames }. The page sets
// data-playback="done" on the body when the recording ends.
interface Recording {
  difficulty: { left: "A" | "B"; right: "A" | "B" };
  frames: number[];
}

const replayUrl = new URLSearchParams(window.location.search).get("replay");

if (replayUrl && body) {
  void fetch(replayUrl)
    .then((response) => response.json() as Promise<Recording>)
    .then((recording) => {
      const { left, right } = recording.difficulty;

      if (btnLeftDiff) btnLeftDiff.textContent = `Left: ${left}`;
      if (btnRightDiff) btnRightDiff.textContent = `Right: ${right}`;
      btnLeftDiff?.classList.toggle("difficulty-active", left === "A");
      btnRightDiff?.classList.toggle("difficulty-active", right === "A");

      body.dataset.playback = "playing";
      startPlayback(recording.frames, left, right, () => {
        body.dataset.playback = "done";
      });
    });
}
