import { Direction, WaitLevel } from "@desordre/shared-types";
import { computeWaitLevel, parseTimeToMinutes } from "./wait-level.js";

describe("parseTimeToMinutes", () => {
  it.each([
    ["08:25", 505],
    ["00:00", 0],
    ["23:59", 1439],
    ["8:05", 485],
    [" 12:30 ", 750],
  ])("parses %p as %p minutes", (input, expected) => {
    expect(parseTimeToMinutes(input)).toBe(expected);
  });

  it.each(["", "abc", "25:00", "12:60", "12h30", "12:3"])("returns null for %p", (input) => {
    expect(parseTimeToMinutes(input)).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
  });
});

describe("computeWaitLevel", () => {
  describe("outbound (train arrives, then the shuttle picks the pax up)", () => {
    it.each([
      ["08:05", "08:25", WaitLevel.OK], // 20 min
      ["07:55", "08:25", WaitLevel.MEDIUM], // exactly 30 min
      ["07:50", "08:25", WaitLevel.MEDIUM], // 35 min
      ["07:25", "08:25", WaitLevel.HIGH], // exactly 60 min
      ["12:30", "14:25", WaitLevel.HIGH],
    ])("train at %s, shuttle at %s -> %s", (train, shuttle, expected) => {
      expect(computeWaitLevel(Direction.OUTBOUND, train, shuttle)).toBe(expected);
    });

    it("never goes negative when the shuttle passes before the train arrives", () => {
      expect(computeWaitLevel(Direction.OUTBOUND, "09:00", "08:25")).toBe(WaitLevel.OK);
    });
  });

  describe("return (the shuttle drops the pax before their train)", () => {
    it.each([
      ["09:35", "09:25", WaitLevel.OK],
      ["09:55", "09:25", WaitLevel.MEDIUM],
      ["10:40", "09:25", WaitLevel.HIGH],
    ])("train at %s, shuttle at %s -> %s", (train, shuttle, expected) => {
      expect(computeWaitLevel(Direction.RETURN, train, shuttle)).toBe(expected);
    });

    it("never goes negative when the shuttle arrives after the train left", () => {
      expect(computeWaitLevel(Direction.RETURN, "09:00", "09:25")).toBe(WaitLevel.OK);
    });
  });

  it("returns null when the trip has no time yet", () => {
    expect(computeWaitLevel(Direction.OUTBOUND, null, "08:25")).toBeNull();
  });

  it("returns null when a time is malformed", () => {
    expect(computeWaitLevel(Direction.OUTBOUND, "8h05", "08:25")).toBeNull();
    expect(computeWaitLevel(Direction.OUTBOUND, "08:05", "")).toBeNull();
  });
});
