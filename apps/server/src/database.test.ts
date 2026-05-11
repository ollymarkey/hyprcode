import { afterEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { createDatabase, type HyprcodeDatabase } from "./database";

let db: HyprcodeDatabase | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

describe("workspace session persistence", () => {
  test("returns null when no latest workspace session exists", async () => {
    db = createDatabase(":memory:");

    const session = await Effect.runPromise(db.getWorkspaceSession("latest"));

    expect(session).toBeNull();
  });

  test("stores and replaces the latest workspace session payload", async () => {
    db = createDatabase(":memory:");

    const first = await Effect.runPromise(
      db.upsertWorkspaceSession({
        payload: {
          version: 1,
          workspaceState: { activeWorkspaceId: "workspace-1", workspaceOrder: [] },
          chatSettingsByWindowId: {},
        },
      }),
    );
    const second = await Effect.runPromise(
      db.upsertWorkspaceSession({
        payload: {
          version: 1,
          workspaceState: { activeWorkspaceId: "workspace-2", workspaceOrder: [] },
          chatSettingsByWindowId: {},
        },
      }),
    );

    expect(first?.id).toBe("latest");
    expect(second?.id).toBe("latest");
    expect(JSON.parse(second?.payloadJson ?? "{}")).toMatchObject({
      workspaceState: { activeWorkspaceId: "workspace-2" },
    });
  });
});
