import { layout, prepare, type PreparedText } from "@chenglou/pretext";

type PretextApi = {
  prepare: (
    text: string,
    font: string,
    options?: { whiteSpace?: "normal" | "pre-wrap" },
  ) => PreparedText;
  layout: (
    prepared: PreparedText,
    maxWidth: number,
    lineHeight: number,
  ) => {
    height: number;
    lineCount: number;
  };
};

export const chatComposerMeasurement = {
  font: '500 14px "Inter Variable"',
  lineHeight: 20,
  minHeight: 44,
  maxHeight: 168,
  verticalPadding: 24,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function estimateFallbackHeight(text: string, width: number): number {
  const safeWidth = Math.max(width, 1);
  const charactersPerLine = Math.max(Math.floor(safeWidth / 8), 1);
  const explicitLines = text.split("\n");
  const lineCount = explicitLines.reduce((count, line) => {
    const nextLineLength = Math.max(line.length, 1);
    return count + Math.ceil(nextLineLength / charactersPerLine);
  }, 0);

  return Math.max(lineCount, 1) * chatComposerMeasurement.lineHeight;
}

export function measureChatComposerHeight(
  text: string,
  width: number,
  api: PretextApi = { prepare, layout },
): number {
  if (width <= 0) {
    return chatComposerMeasurement.minHeight;
  }

  const normalizedText = text.length > 0 ? text : " ";

  try {
    const prepared = api.prepare(normalizedText, chatComposerMeasurement.font, {
      whiteSpace: "pre-wrap",
    });

    const result = api.layout(prepared, width, chatComposerMeasurement.lineHeight);
    const contentHeight =
      result.lineCount === 0 ? chatComposerMeasurement.lineHeight : result.height;

    return clamp(
      contentHeight + chatComposerMeasurement.verticalPadding,
      chatComposerMeasurement.minHeight,
      chatComposerMeasurement.maxHeight,
    );
  } catch {
    return clamp(
      estimateFallbackHeight(normalizedText, width) + chatComposerMeasurement.verticalPadding,
      chatComposerMeasurement.minHeight,
      chatComposerMeasurement.maxHeight,
    );
  }
}
