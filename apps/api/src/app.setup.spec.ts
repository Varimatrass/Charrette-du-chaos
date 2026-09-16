import { parseCorsOrigins } from "./app.setup";
import { DEFAULT_FRONTEND_URL } from "./common/constants";

describe("parseCorsOrigins", () => {
  it("falls back to the dev frontend URL when nothing is configured", () => {
    expect(parseCorsOrigins(undefined)).toEqual([DEFAULT_FRONTEND_URL]);
    expect(parseCorsOrigins("")).toEqual([DEFAULT_FRONTEND_URL]);
    expect(parseCorsOrigins(" , ")).toEqual([DEFAULT_FRONTEND_URL]);
  });

  it("splits a comma-separated list and trims each origin", () => {
    expect(parseCorsOrigins("https://a.example, https://b.example ,")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
