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
});
