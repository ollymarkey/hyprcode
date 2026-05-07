import { describe, expect, test } from "bun:test";
import { splitJsonl } from "../src/transport/jsonl";

describe("JSONL framing", () => {
  test("keeps partial lines buffered", () => {
    const first = splitJsonl("", '{"id":1');

    expect(first.lines).toEqual([]);
    expect(first.buffer).toBe('{"id":1');

    const second = splitJsonl(first.buffer, ',"result":{}}\n');

    expect(second.lines).toEqual(['{"id":1,"result":{}}']);
    expect(second.buffer).toBe("");
  });

  test("parses multiple lines and keeps the trailing partial line", () => {
    const result = splitJsonl("", '{"id":1}\n{"method":"turn/completed"}\n{"id":2');

    expect(result.lines).toEqual(['{"id":1}', '{"method":"turn/completed"}']);
    expect(result.buffer).toBe('{"id":2');
  });
});
