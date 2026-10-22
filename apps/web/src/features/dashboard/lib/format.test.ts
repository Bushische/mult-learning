import { describe, expect, it } from "vitest";
import { formatBank, formatDuration } from "./format";

describe("T17 — formatDuration", () => {
  it("case 1: pins the clock values (M:SS under an hour, H:MM:SS above)", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(113)).toBe("1:53");
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(-5)).toBe("0:00");
  });

  it("keeps formatBank as a thin alias", () => {
    expect(formatBank(45)).toBe("0:45");
    expect(formatBank(2700)).toBe("45:00");
    expect(formatBank(3725)).toBe("1:02:05");
  });
});
