import { describe, test } from "vite-plus/test";
import * as fc from "fast-check";
import { setPlayfieldBit } from "../src/adventure";

// ----------------------------------------------------------------
// setPlayfieldBit — property-based tests
//
// These properties hold for any 21-byte room data array and are
// verified across hundreds of randomly generated inputs.
// ----------------------------------------------------------------

function collectHits(roomData: number[]): [number, number][] {
  const hits: [number, number][] = [];

  setPlayfieldBit(roomData, (cx, ypos) => {
    hits.push([cx, ypos]);
  });

  return hits;
}

// A valid room data array: 21 bytes (7 rows × 3 registers), each 0–255.
const roomDataArb = fc.array(fc.integer({ min: 0, max: 255 }), {
  minLength: 21,
  maxLength: 21,
});

describe("setPlayfieldBit — properties", () => {
  test("cx is always in [0, 19]", () => {
    fc.assert(
      fc.property(roomDataArb, (data) => collectHits(data).every(([cx]) => cx >= 0 && cx <= 19)),
    );
  });

  test("ypos is always in [0, 6]", () => {
    fc.assert(
      fc.property(roomDataArb, (data) =>
        collectHits(data).every(([, ypos]) => ypos >= 0 && ypos <= 6),
      ),
    );
  });

  test("each (cx, ypos) pair is visited at most once", () => {
    fc.assert(
      fc.property(roomDataArb, (data) => {
        const hits = collectHits(data);
        const unique = new Set(hits.map(([cx, ypos]) => `${cx},${ypos}`));

        return unique.size === hits.length;
      }),
    );
  });

  test("total visits never exceeds 140 (7 rows * 20 columns)", () => {
    fc.assert(fc.property(roomDataArb, (data) => collectHits(data).length <= 140));
  });

  test("early termination: stopping at the N-th hit produces exactly N calls", () => {
    fc.assert(
      fc.property(roomDataArb, fc.integer({ min: 1, max: 140 }), (data, stopAt) => {
        let callCount = 0;

        setPlayfieldBit(data, () => {
          callCount++;
          return callCount >= stopAt ? true : undefined;
        });

        const totalBits = collectHits(data).length;

        return callCount === Math.min(stopAt, totalBits);
      }),
    );
  });
});
