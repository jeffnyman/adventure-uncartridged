import { describe, expect, test } from "./fixtures";
import { setPlayfieldBit } from "../src/adventure";

// Room data layout: 7 rows × 3 bytes = 21 bytes.
// Row cy maps to indices (cy*3)+0 = PF0, (cy*3)+1 = PF1, (cy*3)+2 = PF2.
// ypos = 6 - cy, so cy=0 (top of playfield data) yields ypos=6, cy=6 yields ypos=0.
//
// Bit-to-column mapping:
//   PF0 (cx 0–3):   cx=0→0x10, cx=1→0x20, cx=2→0x40, cx=3→0x80  (LSB→MSB, high nibble only)
//   PF1 (cx 4–11):  cx=4→0x80, cx=5→0x40, ..., cx=11→0x01       (MSB→LSB)
//   PF2 (cx 12–19): cx=12→0x01, cx=13→0x02, ..., cx=19→0x80     (LSB→MSB)

function collectHits(roomData: number[]): [number, number][] {
  const hits: [number, number][] = [];

  setPlayfieldBit(roomData, (cx, ypos) => {
    hits.push([cx, ypos]);
  });

  return hits;
}

// Build a 21-zero array with selective overrides by byte index.
function makeRoomData(overrides: Record<number, number> = {}): number[] {
  const data = Array.from({ length: 21 }, () => 0);

  for (const [i, v] of Object.entries(overrides)) {
    data[Number(i)] = v;
  }

  return data;
}

describe("setPlayfieldBit", () => {
  describe("empty playfield", () => {
    test("never calls the callback when all data is zero", () => {
      expect(collectHits(makeRoomData())).toEqual([]);
    });
  });

  // --------------------------------------------------------------
  // PF0 column mapping — cx 0–3
  // Only the high nibble is used; bits 0–3 have no column assignment.
  // --------------------------------------------------------------
  describe("PF0 column mapping (cx 0-3)", () => {
    test("maps bit 4 (0x10) to cx=0", () => {
      expect(collectHits(makeRoomData({ 0: 0x10 }))).toEqual([[0, 6]]);
    });

    test("maps bit 5 (0x20) to cx=1", () => {
      expect(collectHits(makeRoomData({ 0: 0x20 }))).toEqual([[1, 6]]);
    });

    test("maps bit 6 (0x40) to cx=2", () => {
      expect(collectHits(makeRoomData({ 0: 0x40 }))).toEqual([[2, 6]]);
    });

    test("maps bit 7 (0x80) to cx=3", () => {
      expect(collectHits(makeRoomData({ 0: 0x80 }))).toEqual([[3, 6]]);
    });

    test("ignores the low nibble of PF0 (bits 0-3 produce no columns)", () => {
      expect(collectHits(makeRoomData({ 0: 0x0f }))).toEqual([]);
    });
  });

  // --------------------------------------------------------------
  // PF1 column mapping — cx 4–11
  // PF1 is read MSB→LSB: bit 7 is the leftmost column (cx=4),
  // bit 0 rightmost (cx=11).
  // --------------------------------------------------------------
  describe("PF1 column mapping (cx 4-11)", () => {
    test("maps bit 7 (0x80) to cx=4 — PF1 is read MSB→LSB", () => {
      expect(collectHits(makeRoomData({ 1: 0x80 }))).toEqual([[4, 6]]);
    });

    test("maps bit 0 (0x01) to cx=11", () => {
      expect(collectHits(makeRoomData({ 1: 0x01 }))).toEqual([[11, 6]]);
    });
  });

  // --------------------------------------------------------------
  // PF2 column mapping — cx 12–19
  // PF2 reverses back to LSB→MSB: bit 0 is cx=12, bit 7 is cx=19.
  // --------------------------------------------------------------
  describe("PF2 column mapping (cx 12–19)", () => {
    test("maps bit 0 (0x01) to cx=12 — PF2 is read LSB→MSB", () => {
      expect(collectHits(makeRoomData({ 2: 0x01 }))).toEqual([[12, 6]]);
    });

    test("maps bit 7 (0x80) to cx=19", () => {
      expect(collectHits(makeRoomData({ 2: 0x80 }))).toEqual([[19, 6]]);
    });
  });

  // --------------------------------------------------------------
  // Y-axis mapping
  // cy=0 is the first row stored in roomData (top of the hardware
  // scan) but maps to ypos=6 — the highest row index used by the
  // rendering code.
  // --------------------------------------------------------------
  describe("y-position mapping", () => {
    test("maps cy=0 (first stored row) to ypos=6", () => {
      expect(collectHits(makeRoomData({ 0: 0x10 }))[0][1]).toBe(6);
    });

    test("maps cy=6 (last stored row) to ypos=0", () => {
      // cy=6: byte indices 18, 19, 20
      expect(collectHits(makeRoomData({ 18: 0x10 }))[0][1]).toBe(0);
    });

    test("maps cy=3 (middle row) to ypos=3", () => {
      // cy=3: byte indices 9, 10, 11
      expect(collectHits(makeRoomData({ 9: 0x10 }))[0][1]).toBe(3);
    });
  });

  // --------------------------------------------------------------
  // Visit ordering
  // --------------------------------------------------------------
  describe("visit ordering", () => {
    test("visits all 20 columns left to right within a single row", () => {
      // PF0=0xF0 sets cx 0–3; PF1=0xFF sets cx 4–11; PF2=0xFF sets cx 12–19.
      const data = makeRoomData({ 0: 0xf0, 1: 0xff, 2: 0xff });
      const cxOrder = collectHits(data).map(([cx]) => cx);

      expect(cxOrder).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
      ]);
    });

    test("visits rows in top-to-bottom order (ypos 6→0)", () => {
      // One bit per row at cx=0, across all 7 rows.
      const data = Array.from({ length: 21 }, () => 0);

      for (let cy = 0; cy <= 6; cy++) {
        data[cy * 3] = 0x10;
      }

      const yOrder = collectHits(data).map(([, ypos]) => ypos);

      expect(yOrder).toEqual([6, 5, 4, 3, 2, 1, 0]);
    });
  });

  // --------------------------------------------------------------
  // Early termination
  // The callback must return exactly `true` to stop iteration;
  // returning false or void (undefined) continues the scan.
  // --------------------------------------------------------------
  describe("early termination", () => {
    test("stops after the first hit when the callback returns true", () => {
      // 0x30 = bits 4+5 set → cx=0 and cx=1
      let callCount = 0;

      setPlayfieldBit(makeRoomData({ 0: 0x30 }), () => {
        callCount++;
        return true;
      });

      expect(callCount).toBe(1);
    });

    test("continues when the callback returns false", () => {
      let callCount = 0;

      setPlayfieldBit(makeRoomData({ 0: 0x30 }), () => {
        callCount++;
        return false;
      });

      expect(callCount).toBe(2);
    });

    test("continues when the callback returns void", () => {
      // All 20 columns in one row; void return must not stop the scan.
      let callCount = 0;

      setPlayfieldBit(makeRoomData({ 0: 0xf0, 1: 0xff, 2: 0xff }), () => {
        callCount++;
      });

      expect(callCount).toBe(20);
    });
  });
});
