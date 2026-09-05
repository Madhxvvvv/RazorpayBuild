import { describe, expect, it } from "vitest";
import { parseFailureMode } from "../../src/orchestrator/failure-injector.js";

describe("parseFailureMode", () => {
  it.each(["decline", "out_of_stock", "cap_breach"])("accepts %s", (mode) => {
    expect(parseFailureMode(mode)).toBe(mode);
  });

  it("returns undefined for missing header", () => {
    expect(parseFailureMode(undefined)).toBeUndefined();
  });

  it("returns undefined for an unrecognized value", () => {
    expect(parseFailureMode("nonsense")).toBeUndefined();
  });

  it("returns undefined for a non-string value", () => {
    expect(parseFailureMode(123)).toBeUndefined();
  });
});
