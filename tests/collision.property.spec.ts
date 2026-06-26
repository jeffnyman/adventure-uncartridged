import { describe, test } from "vite-plus/test";
import * as fc from "fast-check";
import { hitTestRects } from "../src/adventure";

// ----------------------------------------------------------------
// hitTestRects — property-based tests
//
// HitTestRects uses a y-up coordinate system: `ay` is the TOP of
// rect A and `ay - aheight` is the BOTTOM. Touching edges are NOT
// considered overlapping.
//
// These properties hold for any valid rectangle inputs and are
// verified across hundreds of randomly generated cases, including
// boundary conditions that example-based tests rarely exercise.
// ----------------------------------------------------------------

describe("hitTestRects — properties", () => {
  test("is symmetric: hit(A,B) always equals hit(B,A)", () => {
    // Swapping the two rectangles produces four conditions that
    // are pairwise equivalent, so the result must be identical
    // regardless of argument order.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (ax, ay, aw, ah, bx, by, bw, bh) =>
          hitTestRects(ax, ay, aw, ah, bx, by, bw, bh) ===
          hitTestRects(bx, by, bw, bh, ax, ay, aw, ah),
      ),
    );
  });

  test("never intersects when A is entirely to the left of B (touching or separated)", () => {
    // When B's left edge (bx) is at or past A's right edge (ax + aw),
    // the condition (ax + aw) <= bx is satisfied and the function
    // must return false. gap=0 produces touching edges, which the
    // game also treats as non-overlapping.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }), // ax
        fc.integer({ min: 0, max: 300 }), // ay
        fc.integer({ min: 1, max: 100 }), // aw
        fc.integer({ min: 1, max: 100 }), // ah
        fc.nat({ max: 50 }), // gap: 0 = touching edges, >0 = separated
        fc.integer({ min: 0, max: 300 }), // by
        fc.integer({ min: 1, max: 100 }), // bw
        fc.integer({ min: 1, max: 100 }), // bh
        (ax, ay, aw, ah, gap, by, bw, bh) => {
          const bx = ax + aw + gap;
          return !hitTestRects(ax, ay, aw, ah, bx, by, bw, bh);
        },
      ),
    );
  });

  test("never intersects when A is entirely above B in game-space (touching or separated)", () => {
    // In the game's y-up coordinate system, A is above B when A's
    // bottom (ay - ah) >= B's top (by). This constructs ay so that
    // A's bottom lands exactly at by + gap, ensuring A clears B's
    // top with a gap of zero or more units.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }), // ax
        fc.integer({ min: 1, max: 100 }), // aw
        fc.integer({ min: 1, max: 100 }), // ah
        fc.nat({ max: 50 }), // gap
        fc.integer({ min: 0, max: 200 }), // by (B's top)
        fc.integer({ min: 0, max: 200 }), // bx
        fc.integer({ min: 1, max: 100 }), // bw
        fc.integer({ min: 1, max: 100 }), // bh
        (ax, aw, ah, gap, by, bx, bw, bh) => {
          // A's bottom = ay - ah = by + gap  →  ay = by + ah + gap
          const ay = by + ah + gap;
          return !hitTestRects(ax, ay, aw, ah, bx, by, bw, bh);
        },
      ),
    );
  });

  test("always intersects when B is strictly contained within A", () => {
    // B is constructed by shrinking A by 1 on every side, which
    // guarantees that B lies entirely inside A with no touching
    // edges. Requires aw and ah >= 3 so that B retains positive
    // dimensions after the shrink.
    fc.assert(
      fc.property(
        fc.record({
          ax: fc.integer({ min: 0, max: 200 }),
          ay: fc.integer({ min: 4, max: 300 }),
          aw: fc.integer({ min: 3, max: 100 }),
          ah: fc.integer({ min: 3, max: 100 }),
        }),
        ({ ax, ay, aw, ah }) => hitTestRects(ax, ay, aw, ah, ax + 1, ay - 1, aw - 2, ah - 2),
      ),
    );
  });
});
