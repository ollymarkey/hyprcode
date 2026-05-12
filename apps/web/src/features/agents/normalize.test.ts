import { describe, expect, test } from "vitest";
import { normalizePiEvent } from "./normalize";

describe("Pi event normalization", () => {
  test("maps message updates into assistant deltas", () => {
    const event = normalizePiEvent("session-1", {
      type: "message_update",
      messageId: "assistant-1",
      delta: "hello",
    });

    expect(event.type).toBe("assistant_delta");
    expect(event).toMatchObject({
      sessionId: "session-1",
      messageId: "assistant-1",
      delta: "hello",
    });
  });

  test("maps tool events, queue updates, completion, and errors", () => {
    expect(normalizePiEvent("session-1", { type: "tool_start", tool: "read" })).toMatchObject({
      type: "status",
      status: "running",
      activeTool: "read",
    });
    expect(normalizePiEvent("session-1", { type: "queue_update" })).toMatchObject({
      type: "status",
      status: "running",
    });
    expect(normalizePiEvent("session-1", { type: "completion" })).toMatchObject({
      type: "status",
      status: "complete",
    });
    expect(normalizePiEvent("session-1", { type: "error", error: "Nope" })).toMatchObject({
      type: "error",
      message: "Nope",
    });
  });
});
