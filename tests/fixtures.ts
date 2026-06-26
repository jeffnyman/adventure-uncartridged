import { test as base } from "vite-plus/test";
import { type OBJECT } from "../src/types";

export { describe, expect } from "vite-plus/test";

export const test = base.extend<{
  makeObject: (fields: {
    x: number;
    y: number;
    size: number;
    room: number;
    graphicsData: number[];
    states: number[];
    state?: number;
  }) => OBJECT;
  onePixel: OBJECT;
  threeRowObj: OBJECT;
  nearEdgeObj: OBJECT;
}>({
  // eslint-disable-next-line no-empty-pattern
  makeObject: async ({}, use) => {
    await use((fields) => ({
      graphicsData: fields.graphicsData,
      states: fields.states,
      state: fields.state ?? 0,
      color: 0,
      room: fields.room,
      x: fields.x,
      y: fields.y,
      movementX: 0,
      movementY: 0,
      size: fields.size,
      linkedObject: -1,
      linkedObjectX: 0,
      linkedObjectY: 0,
      displayed: false,
    }));
  },
  onePixel: async ({ makeObject }, use) => {
    await use(
      makeObject({
        x: 5,
        y: 10,
        size: 0,
        room: 0,
        graphicsData: [1, 0x80],
        states: [0],
      }),
    );
  },
  threeRowObj: async ({ makeObject }, use) => {
    await use(
      makeObject({
        x: 5,
        y: 10,
        size: 0,
        room: 0,
        graphicsData: [3, 0xc0, 0xc0, 0xc0],
        states: [0],
      }),
    );
  },
  nearEdgeObj: async ({ makeObject }, use) => {
    await use(
      makeObject({
        x: 158,
        y: 10,
        size: 0,
        room: 0,
        graphicsData: [1, 0x01],
        states: [0],
      }),
    );
  },
});
