import { describe, expect, test } from "./fixtures";

import { hitTestRects, calcPlayerSpriteExtents } from "../src/adventure";

// ----------------------------------------------------------------
// hitTestRects
//
// Coordinates are in the game's flipped-y space: ay is the TOP of
// rect A, (ay - aheight) is the BOTTOM. Touching edges are not
// considered overlapping.
// ----------------------------------------------------------------

describe("hitTestRects", () => {
  test("returns true for identical rectangles", () => {
    expect(hitTestRects(0, 10, 10, 10, 0, 10, 10, 10)).toBe(true);
  });

  test("returns true for partial horizontal overlap", () => {
    // A: x 0–10, B: x 5–15 → overlap at x 5–10
    expect(hitTestRects(0, 20, 10, 10, 5, 20, 10, 10)).toBe(true);
  });

  test("returns true for partial vertical overlap", () => {
    // A: y 10–20, B: y 5–15 → overlap at y 10–15
    expect(hitTestRects(0, 20, 10, 10, 0, 15, 10, 10)).toBe(true);
  });

  test("returns true when one rect is fully inside the other", () => {
    // inner (2,4)–(6,8) sits inside outer (0,0)–(10,10)
    expect(hitTestRects(2, 8, 4, 4, 0, 10, 10, 10)).toBe(true);
  });

  test("returns false when A is to the left of B (edges touching)", () => {
    // A right edge == B left edge: (0+5)=5 <= 5 → no overlap
    expect(hitTestRects(0, 10, 5, 5, 5, 10, 5, 5)).toBe(false);
  });

  test("returns false when A is to the right of B", () => {
    expect(hitTestRects(10, 10, 5, 5, 0, 10, 5, 5)).toBe(false);
  });

  test("returns false when A is above B (edges touching in y)", () => {
    // A spans y 10–20, B spans y 0–10; bottom of A == top of B
    expect(hitTestRects(0, 20, 10, 10, 0, 10, 10, 10)).toBe(false);
  });

  test("returns false when A is below B with a gap", () => {
    // A spans y -5–5, B spans y 10–20
    expect(hitTestRects(0, 5, 10, 10, 0, 20, 10, 10)).toBe(false);
  });

  test("returns true for a single-unit overlap", () => {
    // A: x 0–6, B: x 5–10 → 1-unit overlap
    expect(hitTestRects(0, 10, 6, 10, 5, 10, 5, 10)).toBe(true);
  });
});

// ----------------------------------------------------------------
// calcPlayerSpriteExtents
//
// graphicsData layout:
//   [height0, ...height0 rows..., height1, ...height1 rows...]

// cx = object.x * 2 − CLOCKS_HSYNC(2); cy = object.y * 2
// cw = 16 * ((size/2) + 1);  ch = stateHeight * 2
// ----------------------------------------------------------------

describe("calcPlayerSpriteExtents", () => {
  test("computes correct extent for a size-0 object at its first state", ({ makeObject }) => {
    // x=10 → cx=18, y=20 → cy=40, size=0 → cw=16, height=3 → ch=6
    const obj = makeObject({
      x: 10,
      y: 20,
      size: 0,
      room: 0,
      graphicsData: [3, 0xff, 0xff, 0xff],
      states: [0],
    });

    expect(calcPlayerSpriteExtents(obj)).toEqual({ x: 18, y: 40, w: 16, h: 6 });
  });

  test("doubles the width for size 2", ({ makeObject }) => {
    // size=2 → cw = 16 * ((2/2)+1) = 32
    const obj = makeObject({
      x: 10,
      y: 20,
      size: 2,
      room: 0,
      graphicsData: [3, 0xff, 0xff, 0xff],
      states: [0],
    });

    expect(calcPlayerSpriteExtents(obj)).toEqual({ x: 18, y: 40, w: 32, h: 6 });
  });

  test("reads the correct height for state 0 of a multi-state sprite", ({ makeObject }) => {
    // gfxData: state0 has height=2, state1 has height=4
    const gfx = [2, 0xff, 0xff, 4, 0xaa, 0xbb, 0xcc, 0xdd];
    const obj = makeObject({
      x: 10,
      y: 20,
      size: 0,
      room: 0,
      graphicsData: gfx,
      states: [0, 1],
    });

    expect(calcPlayerSpriteExtents({ ...obj, state: 0 })).toEqual({
      x: 18,
      y: 40,
      w: 16,
      h: 4,
    });
  });

  test("reads the correct height for state 1 of a multi-state sprite", ({ makeObject }) => {
    const gfx = [2, 0xff, 0xff, 4, 0xaa, 0xbb, 0xcc, 0xdd];
    const obj = makeObject({
      x: 10,
      y: 20,
      size: 0,
      room: 0,
      graphicsData: gfx,
      states: [0, 1],
    });
    // stateIndex=states[1]=1 → skip state 0 (2 rows) → height=4 → ch=8
    expect(calcPlayerSpriteExtents({ ...obj, state: 1 })).toEqual({
      x: 18,
      y: 40,
      w: 16,
      h: 8,
    });
  });

  test("reads the correct height for state 2 of a 3-state sprite", ({ makeObject }) => {
    // Three packed frames: heights 2, 4, 3.
    // stateIndex=states[2]=2 → skip frames 0 and 1 → height=3 → ch=6
    const gfx = [2, 0xff, 0xff, 4, 0xaa, 0xbb, 0xcc, 0xdd, 3, 0x11, 0x22, 0x33];
    const obj = makeObject({
      x: 10,
      y: 20,
      size: 0,
      room: 0,
      graphicsData: gfx,
      states: [0, 1, 2],
    });

    expect(calcPlayerSpriteExtents({ ...obj, state: 2 })).toEqual({
      x: 18,
      y: 40,
      w: 16,
      h: 6,
    });
  });

  test("applies bridge-scale size correctly (size=7 → cw=72)", ({ makeObject }) => {
    // objectSize = (7/2)+1 = 4.5; cw = (8*2)*4.5 = 72.
    // The bridge object uses size=0x07 — this confirms the width formula.
    const obj = makeObject({
      x: 10,
      y: 20,
      size: 7,
      room: 0,
      graphicsData: [1, 0xff],
      states: [0],
    });

    expect(calcPlayerSpriteExtents(obj)).toEqual({ x: 18, y: 40, w: 72, h: 2 });
  });
});
