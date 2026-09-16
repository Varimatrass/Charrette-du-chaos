import { toDate, toDateOrNull } from "./dates";

describe("toDateOrNull", () => {
  it("keeps undefined (field not provided)", () => {
    expect(toDateOrNull(undefined)).toBeUndefined();
  });

  it("maps null and blank strings to null (field cleared)", () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull("")).toBeNull();
    expect(toDateOrNull("   ")).toBeNull();
  });

  it("parses an ISO date", () => {
    expect(toDateOrNull("2026-09-18")).toEqual(new Date("2026-09-18"));
  });
});

describe("toDate", () => {
  it("parses an ISO date", () => {
    expect(toDate("2026-09-18").toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });
});
