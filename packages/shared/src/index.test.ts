import { describe, expect, test } from "bun:test";

import { clamp, formatRelativeTimestamp } from "./index";

describe("shared helpers", () => {
  test("clamp bounds values", () => {
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(-1, 0, 5)).toBe(0);
  });

  test("formats recent timestamps", () => {
    const iso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTimestamp(iso)).toContain("m ago");
  });
});
