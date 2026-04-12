import { describe, expect, test } from "vitest";
import { chatComposerMeasurement, measureChatComposerHeight } from "./pretext-measure";

describe("measureChatComposerHeight", () => {
  test("returns the minimum height when width is unavailable", () => {
    expect(measureChatComposerHeight("hello", 0)).toBe(chatComposerMeasurement.minHeight);
  });

  test("clamps measured height to the configured maximum", () => {
    const height = measureChatComposerHeight("hello", 280, {
      prepare: () => ({}) as never,
      layout: () => ({
        height: 1000,
        lineCount: 30,
      }),
    });

    expect(height).toBe(chatComposerMeasurement.maxHeight);
  });

  test("uses the fallback estimator when pretext measurement fails", () => {
    const height = measureChatComposerHeight("one\ntwo\nthree", 120, {
      prepare() {
        throw new Error("measurement unavailable");
      },
      layout: () => ({
        height: 0,
        lineCount: 0,
      }),
    });

    expect(height).toBeGreaterThanOrEqual(chatComposerMeasurement.minHeight);
  });
});
