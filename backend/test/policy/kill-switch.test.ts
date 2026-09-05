import { beforeEach, describe, expect, it } from "vitest";
import { disengage, engage, isEngaged, resetAll } from "../../src/policy/kill-switch.js";

beforeEach(() => {
  resetAll();
});

describe("kill switch", () => {
  it("is disengaged by default", () => {
    expect(isEngaged("merchant-1")).toBe(false);
  });

  it("engages independently per merchant", () => {
    engage("merchant-1");
    expect(isEngaged("merchant-1")).toBe(true);
    expect(isEngaged("merchant-2")).toBe(false);
  });

  it("disengages", () => {
    engage("merchant-1");
    disengage("merchant-1");
    expect(isEngaged("merchant-1")).toBe(false);
  });

  it("resetAll clears every merchant", () => {
    engage("merchant-1");
    engage("merchant-2");
    resetAll();
    expect(isEngaged("merchant-1")).toBe(false);
    expect(isEngaged("merchant-2")).toBe(false);
  });
});
