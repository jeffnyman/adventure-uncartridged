import "./style.css";
import { audit } from "./utils/logger";

document.documentElement.classList.replace("no-js", "js");

audit(import.meta.env.VITE_APP_TITLE);
