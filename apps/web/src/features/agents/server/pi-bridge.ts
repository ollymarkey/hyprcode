import { normalizePiEvent } from "../normalize";
import { piSessionRegistry } from "./session-registry";
import { Type } from "typebox";
import type {
  AgentSession,
  AgentSessionEvent,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type {
  AgentApprovalRequest,
  AgentPreviewPayload,
  AgentSessionMetadata,
  CreateAgentSessionInput,
  NormalizedAgentEvent,
  ResolveAgentApprovalInput,
} from "../types";

const ALLOWED_WRITE_ROOTS = [
  "apps/web/src/features",
  "apps/web/src/components",
  "apps/web/src/routes",
  "apps/web/src/styles.css",
];

const REQUIRED_CHECKS = ["bun run fmt", "bun run lint"];

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

export function getPiEditingPolicy() {
  return {
    allowedWriteRoots: ALLOWED_WRITE_ROOTS,
    requiredChecks: REQUIRED_CHECKS,
    tools: [
      "hyprcode_propose_source_edit",
      "hyprcode_apply_source_edit",
      "hyprcode_run_check",
      "hyprcode_show_widget",
    ],
  };
}

export class PiAgentBridge {
  async createSession(input: CreateAgentSessionInput): Promise<NormalizedAgentEvent> {
    const piSession = await this.createPiSdkSession(input.cwd);
    const createdAt = now();
    const session: AgentSessionMetadata = {
      id: piSession.sessionId,
      windowId: input.windowId,
      repoId: input.repoId,
      cwd: input.cwd,
      status: "idle",
      modelLabel: piSession.model?.name ?? "Pi",
      createdAt,
      updatedAt: createdAt,
    };

    const record = piSessionRegistry.create(session, piSession);
    record.unsubscribePi = piSession.subscribe((event) => {
      const normalizedEvent = normalizePiEvent(session.id, event as AgentSessionEvent);
      piSessionRegistry.appendEvent(normalizedEvent);
      this.updateSessionFromEvent(normalizedEvent);
      normalizeHyprcodeToolEvents(session.id, event).forEach((toolEvent) => {
        piSessionRegistry.appendEvent(toolEvent);
        this.updateSessionFromEvent(toolEvent);
      });
    });

    const event: NormalizedAgentEvent = {
      id: createId("event"),
      sessionId: session.id,
      type: "session_created",
      session,
      createdAt,
    };

    piSessionRegistry.appendEvent(event);
    return event;
  }

  async sendPrompt(sessionId: string, _prompt: string): Promise<NormalizedAgentEvent> {
    const record = piSessionRegistry.get(sessionId);

    if (!record?.piSession) {
      throw new Error(`Unknown Pi session: ${sessionId}`);
    }

    piSessionRegistry.updateMetadata(sessionId, {
      status: "running",
      activeTool: "pi",
    });

    const event: NormalizedAgentEvent = {
      id: createId("event"),
      sessionId,
      type: "status",
      status: "running",
      label: "Pi run started",
      activeTool: "pi",
      createdAt: now(),
    };

    piSessionRegistry.appendEvent(event);
    void (record.piSession as AgentSession).prompt(_prompt).catch((error: unknown) => {
      piSessionRegistry.appendEvent({
        id: createId("event"),
        sessionId,
        type: "error",
        message: error instanceof Error ? error.message : "Pi prompt failed",
        createdAt: now(),
      });
      piSessionRegistry.updateMetadata(sessionId, { status: "error", activeTool: undefined });
    });

    return event;
  }

  async abort(sessionId: string): Promise<NormalizedAgentEvent> {
    const record = piSessionRegistry.get(sessionId);

    if (record?.piSession) {
      await (record.piSession as AgentSession).abort();
    }

    piSessionRegistry.updateMetadata(sessionId, { status: "aborted", activeTool: undefined });

    const event: NormalizedAgentEvent = {
      id: createId("event"),
      sessionId,
      type: "status",
      status: "aborted",
      label: "Pi run aborted",
      createdAt: now(),
    };

    piSessionRegistry.appendEvent(event);
    return event;
  }

  async resolveApproval(input: ResolveAgentApprovalInput): Promise<NormalizedAgentEvent> {
    const event: NormalizedAgentEvent = {
      id: createId("event"),
      sessionId: input.sessionId,
      type: "approval_resolved",
      approvalId: input.approvalId,
      decision: input.decision,
      createdAt: now(),
    };

    piSessionRegistry.appendEvent(event);
    return event;
  }

  createSourceEditApproval(sessionId: string, payload: AgentPreviewPayload): AgentApprovalRequest {
    return {
      id: createId("approval"),
      sessionId,
      title: "Approve frontend source edit",
      description: "Pi needs approval before mutating hyprcode frontend source files.",
      risk: "medium",
      payload,
      status: "pending",
      createdAt: now(),
    };
  }

  private async createPiSdkSession(cwd: string): Promise<AgentSession> {
    const pi = await import("@earendil-works/pi-coding-agent");
    const result = await pi.createAgentSession({
      cwd,
      customTools: createHyprcodeTools(),
    });

    return result.session;
  }

  private updateSessionFromEvent(event: NormalizedAgentEvent) {
    if (event.type === "status") {
      piSessionRegistry.updateMetadata(event.sessionId, {
        status: event.status,
        activeTool: event.activeTool,
      });
    }

    if (event.type === "error") {
      piSessionRegistry.updateMetadata(event.sessionId, {
        status: "error",
        activeTool: undefined,
      });
    }
  }
}

export const piAgentBridge = new PiAgentBridge();

function normalizeHyprcodeToolEvents(
  sessionId: string,
  event: AgentSessionEvent,
): NormalizedAgentEvent[] {
  if (event.type !== "tool_execution_end") {
    return [];
  }

  const details = event.result?.details;

  if (!details || typeof details !== "object") {
    return [];
  }

  const createdAt = now();

  if (event.toolName === "hyprcode_show_widget") {
    const widget = details as {
      kind?: string;
      title?: string;
      detail?: string;
      path?: string;
      command?: string;
      content?: string;
      diff?: string;
    };
    const previewId = createId("preview");
    const title = widget.title ?? "Pi widget";

    return [
      {
        id: createId("event"),
        sessionId,
        type: "preview",
        previewId,
        payload:
          widget.kind === "diff"
            ? {
                kind: "diff",
                title,
                files: widget.path ? [widget.path] : [],
                diff: widget.diff ?? widget.content ?? "",
              }
            : widget.kind === "command_output"
              ? {
                  kind: "command_output",
                  title,
                  command: widget.command ?? "",
                  output: widget.content ?? widget.detail ?? "",
                }
              : widget.kind === "file"
                ? {
                    kind: "file",
                    title,
                    path: widget.path ?? "",
                    content: widget.content ?? "",
                  }
                : {
                    kind: "status",
                    title,
                    detail: widget.detail ?? widget.content ?? "",
                  },
        createdAt,
      },
    ];
  }

  if (event.toolName === "hyprcode_propose_source_edit") {
    const proposal = details as {
      summary?: string;
      files?: string[];
      diff?: string;
    };
    const approvalId = createId("approval");
    const payload = {
      kind: "diff" as const,
      title: proposal.summary ?? "Proposed source edit",
      files: proposal.files ?? [],
      diff: proposal.diff ?? "",
    };

    return [
      {
        id: createId("event"),
        sessionId,
        type: "preview",
        previewId: createId("preview"),
        payload,
        createdAt,
      },
      {
        id: createId("event"),
        sessionId,
        type: "approval_requested",
        approval: {
          id: approvalId,
          sessionId,
          title: "Approve frontend source edit",
          description: proposal.summary ?? "Pi proposed a frontend source edit.",
          risk: "medium",
          payload,
          status: "pending",
          createdAt,
        },
        createdAt,
      },
    ];
  }

  if (event.toolName === "hyprcode_run_check") {
    const check = details as {
      command?: string;
      reason?: string;
    };

    return [
      {
        id: createId("event"),
        sessionId,
        type: "preview",
        previewId: createId("preview"),
        payload: {
          kind: "command_output",
          title: "Requested check",
          command: check.command ?? "",
          output: check.reason ?? "",
        },
        createdAt,
      },
    ];
  }

  return [];
}

function createHyprcodeTools(): ToolDefinition[] {
  return [
    {
      name: "hyprcode_show_widget",
      label: "Show hyprcode widget",
      description:
        "Emit a typed hyprcode UI widget such as status, diff preview, command output, or file preview.",
      parameters: Type.Object({
        kind: Type.Union([
          Type.Literal("status"),
          Type.Literal("diff"),
          Type.Literal("command_output"),
          Type.Literal("file"),
        ]),
        title: Type.String(),
        detail: Type.Optional(Type.String()),
        path: Type.Optional(Type.String()),
        command: Type.Optional(Type.String()),
        content: Type.Optional(Type.String()),
        diff: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        const widget = params as {
          kind: string;
          title: string;
        };

        return {
          content: [{ type: "text", text: `Displayed ${widget.kind} widget: ${widget.title}` }],
          details: widget,
        };
      },
    },
    {
      name: "hyprcode_propose_source_edit",
      label: "Propose hyprcode source edit",
      description:
        "Describe a frontend source edit and return a diff preview. This proposes work only; applying requires approval.",
      parameters: Type.Object({
        summary: Type.String(),
        files: Type.Array(Type.String()),
        diff: Type.String(),
      }),
      async execute(_toolCallId, params) {
        const proposal = params as {
          summary: string;
          files: string[];
          diff: string;
        };

        return {
          content: [
            {
              type: "text",
              text: `Proposed source edit: ${proposal.summary}. Waiting for user approval before applying.`,
            },
          ],
          details: proposal,
        };
      },
    },
    {
      name: "hyprcode_apply_source_edit",
      label: "Apply approved hyprcode source edit",
      description:
        "Record that an approved source edit should be applied through hyprcode's approval path. Direct writes remain approval-gated.",
      parameters: Type.Object({
        approvalId: Type.String(),
        summary: Type.String(),
      }),
      async execute(_toolCallId, params) {
        const edit = params as {
          approvalId: string;
          summary: string;
        };

        return {
          content: [
            {
              type: "text",
              text: `Approval ${edit.approvalId} accepted for: ${edit.summary}`,
            },
          ],
          details: edit,
        };
      },
    },
    {
      name: "hyprcode_run_check",
      label: "Run hyprcode check",
      description:
        "Request a hyprcode project check. Known checks are fmt, lint, check-types, build, and test.",
      parameters: Type.Object({
        command: Type.String(),
        reason: Type.String(),
      }),
      async execute(_toolCallId, params) {
        const check = params as {
          command: string;
          reason: string;
        };

        return {
          content: [
            { type: "text", text: `Requested check: ${check.command}. Reason: ${check.reason}` },
          ],
          details: check,
        };
      },
    },
  ];
}
