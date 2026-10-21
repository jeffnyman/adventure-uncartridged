// Records a video of the real game playing back an input file.
//
// It opens the page with ?replay=<file> in headless Chromium, streams
// the page's screencast into ffmpeg as it plays, and stops once the
// page reports that playback has finished. The video has no sound.
//
// Needs a running dev server (vp dev), the playwright package and an
// ffmpeg that can encode VP8. Playwright is not a project dependency,
// so these environment variables can point at installed copies:
//
//   PLAYWRIGHT  path to playwright's index.mjs, if a plain import fails
//   CHROMIUM    path to a Chromium executable, if Playwright's own is missing
//   FFMPEG      path to ffmpeg, if it is not on the PATH
//
// Example:
//   node tools/agent/record.mjs http://localhost:5173/adventure-uncartridged/ \
//     tools/agent/game1-win.json tools/agent/game1-win.webm

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const [pageUrl, recordingPath, videoPath] = process.argv.slice(2);

if (!pageUrl || !recordingPath || !videoPath) {
  console.error("usage: node record.mjs <page url> <recording.json> <video.webm>");
  process.exit(1);
}

const playwright = process.env.PLAYWRIGHT
  ? await import(pathToFileURL(process.env.PLAYWRIGHT).href)
  : await import("playwright");
const { chromium } = playwright.default ?? playwright;

const FPS = 30;
const size = { width: 960, height: 720 };

const ffmpeg = spawn(
  process.env.FFMPEG ?? "ffmpeg",
  [
    // These match the settings Playwright uses with its own ffmpeg build.
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-avioflags",
    "direct",
    "-fpsprobesize",
    "0",
    "-probesize",
    "32",
    "-analyzeduration",
    "0",
    "-c:v",
    "mjpeg",
    "-framerate",
    String(FPS),
    "-i",
    "pipe:0",
    "-y",
    "-an",
    "-c:v",
    "vp8",
    "-qmin",
    "0",
    "-qmax",
    "50",
    "-crf",
    "8",
    "-deadline",
    "realtime",
    "-speed",
    "8",
    "-b:v",
    "4M",
    "-threads",
    "1",
    videoPath,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const encoded = new Promise((resolve, reject) => {
  ffmpeg.on("error", reject);
  ffmpeg.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
  );
});

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: size });

// The screencast only sends a frame when the page changes, so a
// timer writes the latest frame at a steady rate. Timers slip under
// load, so each tick writes as many frames as the wall clock says
// are due, which keeps the video at real-time speed.
const cdp = await page.context().newCDPSession(page);
let latest = null;
cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
  latest = Buffer.from(data, "base64");
  void cdp.send("Page.screencastFrameAck", { sessionId });
});
await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 90,
  maxWidth: size.width,
  maxHeight: size.height,
});
let startedAt = 0;
let written = 0;
const writer = setInterval(() => {
  if (!latest) return;
  if (!startedAt) startedAt = performance.now();
  const due = Math.floor(((performance.now() - startedAt) / 1000) * FPS) + 1;
  for (; written < due; written++) ffmpeg.stdin.write(latest);
}, 1000 / FPS);

const url = new URL(pageUrl);
url.searchParams.set("replay", new URL(recordingPath, url).pathname);

await page.goto(url.href);
await page.click("#btn-fullscreen");
await page.waitForSelector("body[data-playback='done']", { timeout: 10 * 60 * 1000 });

// Hold the final frames briefly so the win is visible.
await page.waitForTimeout(1500);

clearInterval(writer);
await cdp.send("Page.stopScreencast");
await browser.close();
ffmpeg.stdin.end();
await encoded;

console.log(`saved ${videoPath}`);
