import * as fc from "fast-check";
import { describe, expect, test } from "./fixtures";

import { pickRandomRoom } from "../src/adventure";
import { roomBoundsData } from "../src/data/rooms";
import { ObjectId } from "../src/types";

// ----------------------------------------------------------------
// pickRandomRoom
//
// Game 3 scatters objects by picking a random room 0-31 and retrying
// until it lands within that object's bounds. A scripted RNG is used
// so a pick that can never succeed fails fast instead of hanging.
// ----------------------------------------------------------------

// Returns the given values in order, then throws if asked for more.
function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("RNG exhausted: no in-bounds room was picked");
    return values[i++];
  };
}

// Wraps Math.random but gives up after a fixed number of calls.
function boundedRng(maxCalls: number): () => number {
  let calls = 0;
  return () => {
    if (++calls > maxCalls) throw new Error(`RNG exhausted after ${maxCalls} calls`);
    return Math.random();
  };
}

describe("pickRandomRoom", () => {
  test("maps the low end of the RNG range to room 0", () => {
    expect(pickRandomRoom(0, 31, scriptedRng([0]))).toBe(0);
  });

  test("maps the high end of the RNG range to room 31", () => {
    expect(pickRandomRoom(0, 31, scriptedRng([0.9999]))).toBe(31);
  });

  test("can reach every room from 0 to 31", () => {
    for (let room = 0; room < 32; room++) {
      expect(pickRandomRoom(0, 31, scriptedRng([room / 32]))).toBe(room);
    }
  });

  test("retries until a pick lands within the bounds", () => {
    // 0.0 picks room 0, which is below the lower bound of 1.
    // 0.5 picks room 16, which is accepted.
    expect(pickRandomRoom(1, 29, scriptedRng([0, 0.5]))).toBe(16);
  });

  test("places every Game 3 object within its bounds", () => {
    for (let i = 0; roomBoundsData[i] !== ObjectId.None; i += 3) {
      const lower = roomBoundsData[i + 1];
      const upper = roomBoundsData[i + 2];
      const room = pickRandomRoom(lower, upper, boundedRng(10_000));

      expect(room).toBeGreaterThanOrEqual(lower);
      expect(room).toBeLessThanOrEqual(upper);
    }
  });
});

describe("pickRandomRoom — properties", () => {
  test("always returns an integer room within the bounds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 31 }), fc.integer({ min: 0, max: 31 }), (a, b) => {
        const lower = Math.min(a, b);
        const upper = Math.max(a, b);
        const room = pickRandomRoom(lower, upper, boundedRng(100_000));

        expect(Number.isInteger(room)).toBe(true);
        expect(room).toBeGreaterThanOrEqual(lower);
        expect(room).toBeLessThanOrEqual(upper);
      }),
    );
  });
});
