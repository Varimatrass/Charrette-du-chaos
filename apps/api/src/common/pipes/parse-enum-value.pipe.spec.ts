import { BadRequestException } from "@nestjs/common";
import { Direction } from "@desordre/shared-types";
import { ParseEnumValuePipe } from "./parse-enum-value.pipe.js";

describe("ParseEnumValuePipe", () => {
  const pipe = new ParseEnumValuePipe(Direction);

  it("accepts a known value", () => {
    expect(pipe.transform("OUTBOUND")).toBe(Direction.OUTBOUND);
    expect(pipe.transform("RETURN")).toBe(Direction.RETURN);
  });

  it("rejects an unknown value with a 400 listing the accepted ones", () => {
    expect(() => pipe.transform("SIDEWAYS")).toThrow(BadRequestException);
    expect(() => pipe.transform("SIDEWAYS")).toThrow(/OUTBOUND, RETURN/);
  });

  it("is case sensitive (enum values are stored as-is in the database)", () => {
    expect(() => pipe.transform("outbound")).toThrow(BadRequestException);
  });
});
