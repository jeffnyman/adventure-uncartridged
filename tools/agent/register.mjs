// Lets Node run the game's TypeScript source headlessly.
//
// Node strips TypeScript types natively, but the game's imports
// omit the .ts extension (Vite resolves them in the browser build).
// This hook adds the extension, and swaps the browser hardware
// layer for headless-hardware.ts so no canvas, audio or keyboard
// is needed.
//
// Usage: node --import ./tools/agent/register.mjs <script.ts>

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const headless = new URL("./headless-hardware.ts", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      let url = new URL(specifier, context.parentURL);

      if (!url.pathname.match(/\.[cm]?[jt]s$/)) {
        const withTs = new URL(url.href + ".ts");
        if (existsSync(fileURLToPath(withTs))) url = withTs;
      }

      const path = fileURLToPath(url).replaceAll("\\", "/");

      if (path.endsWith("/src/hardware.ts") && context.parentURL !== headless) {
        return { url: headless, shortCircuit: true };
      }

      return nextResolve(pathToFileURL(fileURLToPath(url)).href, context);
    }

    return nextResolve(specifier, context);
  },
});
