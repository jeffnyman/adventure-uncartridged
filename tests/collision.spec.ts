import { describe, expect, test } from "vite-plus/test";

import { hitTestRects } from "../src/adventure";

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
