import { describe, expect, test } from "./fixtures";

import { hitTestRects, calcPlayerSpriteExtents, collisionCheckObject } from "../src/adventure";

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

// ----------------------------------------------------------------
// collisionCheckObject
//
// Tests a rectangle (x, y, width, height) against an OBJECT's
// pixel map.
// Object pixel positions: objectX = obj.x*2 − 2, objectY = obj.y*2
// For ONE_PIXEL_GFX at x=5,y=10, the pixel lands at screen
// coord (8, 20) with size (2,2).
// ----------------------------------------------------------------

describe("collisionCheckObject", () => {
  test("detects a rectangle exactly at the object pixel", ({ onePixel }) => {
    expect(collisionCheckObject(onePixel, 8, 20, 2, 2)).toBe(true);
  });

  test("detects a larger rectangle that overlaps the object pixel", ({ onePixel }) => {
    // Pixel at (8, 20, 2, 2): top=20, bottom=18 in flipped-y space.
    // (7, 21, 4, 4) encloses the pixel on all sides.
    expect(collisionCheckObject(onePixel, 7, 21, 4, 4)).toBe(true);
  });

  test("returns false for a rectangle whose left edge touches the pixel right edge", ({
    onePixel,
  }) => {
    // Pixel occupies x 8–10; rect starts at x=10 → touching but not overlapping
    expect(collisionCheckObject(onePixel, 10, 20, 2, 2)).toBe(false);
  });

  test("returns false for a rectangle far from the object", ({ onePixel }) => {
    expect(collisionCheckObject(onePixel, 200, 100, 10, 10)).toBe(false);
  });

  test("detects the second pixel in the top row (bit 6)", ({ threeRowObj }) => {
    expect(collisionCheckObject(threeRowObj, 10, 20, 2, 2)).toBe(true);
  });

  test("detects a hit in the bottom row, confirming Y traversal reaches all rows", ({
    threeRowObj,
  }) => {
    expect(collisionCheckObject(threeRowObj, 8, 16, 2, 2)).toBe(true);
  });

  test("returns false for a rectangle to the right of all pixels", ({ threeRowObj }) => {
    // Pixels span x 18–22; a rect at x=22 only touches, not overlaps.
    expect(collisionCheckObject(threeRowObj, 22, 20, 2, 2)).toBe(false);
  });

  test("detects a hit at the wrapped position when a pixel crosses the right screen edge", ({
    nearEdgeObj,
  }) => {
    // Sprite with only the rightmost pixel set (bit 7 of the byte → bit index 7).
    // objectX = 158*2 − 2 = 314; bit 7 pixel: unwrapped x = 314 + 7*2 = 328.
    // 328 >= ADVENTURE_SCREEN_WIDTH (320) → wraps to 8.
    expect(collisionCheckObject(nearEdgeObj, 8, 20, 2, 2)).toBe(true); // wrapped position hits
    expect(collisionCheckObject(nearEdgeObj, 328, 20, 2, 2)).toBe(false); // unwrapped position misses
  });
});
