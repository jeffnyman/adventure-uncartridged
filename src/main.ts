import "./style.css";
import { audit } from "./utils/logger";
import { run } from "./hardware";
import { startGame } from "./adventure";

document.documentElement.classList.replace("no-js", "js");

audit(import.meta.env.VITE_APP_TITLE);

run(startGame);
