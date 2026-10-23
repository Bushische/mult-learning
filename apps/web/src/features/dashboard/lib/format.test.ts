import { describe, expect, it } from "vitest";
import {
  formatBank,
  formatDuration,
  formatSignedDuration,
  lostSeconds,
  netEarnedSeconds,
} from "./format";

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

describe("T37 — net time math", () => {
  it("lostSeconds is wrong answers times the game's penalty", () => {
    expect(lostSeconds(3, 2, 5)).toBe(5);
    expect(lostSeconds(1, 1, 5)).toBe(0);
    expect(lostSeconds(0, 0, 10)).toBe(0);
  });

  it("netEarnedSeconds subtracts the lost seconds from the earned ones", () => {
    expect(netEarnedSeconds(20, 3, 2, 5)).toBe(15);
    expect(netEarnedSeconds(10, 1, 1, 5)).toBe(10);
    expect(netEarnedSeconds(0, 1, 0, 5)).toBe(-5);
  });

  it("formatSignedDuration prefixes the sign without clamping", () => {
    expect(formatSignedDuration(15)).toBe("+0:15");
    expect(formatSignedDuration(0)).toBe("+0:00");
    expect(formatSignedDuration(-5)).toBe("−0:05");
  });
});
