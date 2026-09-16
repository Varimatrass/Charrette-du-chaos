import { omitKeys, omitUndefined } from "./objects";

describe("omitUndefined", () => {
  it("drops undefined values but keeps null and falsy ones", () => {
    expect(omitUndefined({ a: undefined, b: null, c: 0, d: "", e: false, f: "x" })).toEqual({
      b: null,
      c: 0,
      d: "",
      e: false,
      f: "x",
    });
  });

  it("returns an empty object for an all-undefined input", () => {
    expect(omitUndefined({ a: undefined })).toEqual({});
  });

  it("does not mutate its input", () => {
    const input = { a: undefined, b: 1 };
    omitUndefined(input);
    expect(input).toEqual({ a: undefined, b: 1 });
  });
});

describe("omitKeys", () => {
  it("removes the given keys and returns a copy", () => {
    const input = { id: "1", accessToken: "secret", name: "Alix" };
    const result = omitKeys(input, ["accessToken"]);
    expect(result).toEqual({ id: "1", name: "Alix" });
    expect(input.accessToken).toBe("secret");
  });
});
