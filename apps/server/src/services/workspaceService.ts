import type {
  ChatMessage,
  ServerEvent,
  TerminalSessionSummary,
  ThreadSummary,
  WorkspaceBootstrapPayload,
  WorkspaceLayoutSnapshot,
  WorkspacePane,
} from "@hyprcode/contracts";
import { createId } from "@hyprcode/shared";

import { CodexProcessManager, makeSyntheticAssistantMessage } from "./codexProcessManager";
import { JsonWorkspaceStore } from "../storage/jsonWorkspaceStore";
import type { ServerState } from "../storage/seedState";

export class WorkspaceService {
  private readonly terminals = new Map<string, TerminalSessionSummary>();

  constructor(
    private readonly store: JsonWorkspaceStore,
    private readonly codex: CodexProcessManager,
    private readonly broadcast: (event: ServerEvent) => void,
  ) {}

  async bootstrap(): Promise<WorkspaceBootstrapPayload> {
    const state = await this.store.read();
    return {
      projects: state.projects,
      threads: state.threads,
      layout: state.layout,
    };
  }

  async listProjects() {
    return (await this.store.read()).projects;
  }

  async listThreads() {
    return (await this.store.read()).threads;
  }

  async saveLayout(layout: WorkspaceLayoutSnapshot) {
    const state = await this.store.read();
    const next: ServerState = {
      ...state,
      layout: {
        ...layout,
        updatedAt: new Date().toISOString(),
      },
    };
    await this.store.write(next);
    this.broadcast({ type: "workspace.layout.updated", layout: next.layout });
    return next.layout;
  }

  async createPane(): Promise<WorkspacePane> {
    const state = await this.store.read();
    const nextPane: WorkspacePane = {
      id: createId("pane"),
      order: state.layout.panes.length,
      threadId: null,
      projectId: null,
      focused: false,
      terminalOpen: false,
      collapsed: false,
      scrollTop: 0,
    };
    state.layout.panes.push(nextPane);
    state.layout.updatedAt = new Date().toISOString();
    await this.store.write(state);
    this.broadcast({ type: "workspace.layout.updated", layout: state.layout });
    return nextPane;
  }

  async removePane(paneId: string) {
    const state = await this.store.read();
    const panes = state.layout.panes.filter((pane) => pane.id !== paneId).map((pane, index) => ({
      ...pane,
      order: index,
    }));
    const nextFocusedPaneId = state.layout.focusedPaneId === paneId ? panes[0]?.id ?? null : state.layout.focusedPaneId;
    state.layout.focusedPaneId = nextFocusedPaneId;
    state.layout.panes = panes.map((pane) => ({
      ...pane,
      focused: pane.id === nextFocusedPaneId,
    }));
    state.layout.updatedAt = new Date().toISOString();
    await this.store.write(state);
    this.broadcast({ type: "workspace.layout.updated", layout: state.layout });
    return state.layout;
  }

  async focusPane(paneId: string) {
    const state = await this.store.read();
    state.layout.focusedPaneId = paneId;
    state.layout.panes = state.layout.panes.map((pane) => ({
      ...pane,
      focused: pane.id === paneId,
    }));
    state.layout.updatedAt = new Date().toISOString();
    await this.store.write(state);
    this.broadcast({ type: "workspace.layout.updated", layout: state.layout });
    return state.layout;
  }

  async createThread(projectId: string, title?: string) {
    const state = await this.store.read();
    const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0]!;
    const now = new Date().toISOString();
    const thread: ThreadSummary = {
      id: createId("thread"),
      projectId: project.id,
      title: title ?? `New session in ${project.name}`,
      summary: project.summary,
      lastActivityAt: now,
      model: "gpt-5-codex",
      sessionState: "idle",
      branch: project.branch,
      worktree: project.worktree,
      messages: [
        {
          id: createId("msg"),
          role: "system",
          content: `Session created for ${project.name}`,
          createdAt: now,
        },
      ],
    };
    state.threads.unshift(thread);
    const emptyPane = state.layout.panes.find((pane) => pane.threadId === null);
    if (emptyPane) {
      emptyPane.threadId = thread.id;
      emptyPane.projectId = thread.projectId;
    }
    await this.store.write(state);
    this.broadcast({ type: "thread.updated", thread });
    this.broadcast({ type: "workspace.layout.updated", layout: state.layout });
    return thread;
  }

  async sendMessage(threadId: string, content: string) {
    const state = await this.store.read();
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    await this.codex.ensureRunning();

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content,
      createdAt: now,
    };
    const assistantMessage = makeSyntheticAssistantMessage(content);

    thread.messages = [...thread.messages, userMessage, assistantMessage];
    thread.lastActivityAt = now;
    thread.sessionState = this.codex.deriveNextState("connecting");
    await this.store.write(state);
    this.broadcast({ type: "thread.updated", thread });
    return thread;
  }

  async respondToRequest(threadId: string, response: string) {
    return this.sendMessage(threadId, response);
  }

  async resumeThread(threadId: string) {
    const state = await this.store.read();
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.sessionState = "active";
    thread.lastActivityAt = new Date().toISOString();
    await this.store.write(state);
    this.broadcast({ type: "thread.updated", thread });
    return thread;
  }

  async closeThread(threadId: string) {
    const state = await this.store.read();
    const thread = state.threads.find((item) => item.id === threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    thread.sessionState = "closed";
    thread.lastActivityAt = new Date().toISOString();
    await this.store.write(state);
    this.broadcast({ type: "thread.updated", thread });
    return thread;
  }

  async openTerminal(paneId: string) {
    const terminal = {
      paneId,
      terminalId: createId("terminal"),
      open: true,
    };
    this.terminals.set(paneId, terminal);
    await this.setTerminalState(paneId, true);
    return terminal;
  }

  async writeTerminal(paneId: string, _data: string) {
    return this.terminals.get(paneId) ?? this.openTerminal(paneId);
  }

  async resizeTerminal(paneId: string, _cols: number, _rows: number) {
    return this.terminals.get(paneId) ?? this.openTerminal(paneId);
  }

  async closeTerminal(paneId: string) {
    this.terminals.delete(paneId);
    await this.setTerminalState(paneId, false);
    return { paneId, open: false };
  }

  async codexStatus() {
    return this.codex.getStatus();
  }

  private async setTerminalState(paneId: string, open: boolean) {
    const state = await this.store.read();
    state.layout.panes = state.layout.panes.map((pane) =>
      pane.id === paneId ? { ...pane, terminalOpen: open } : pane,
    );
    state.layout.updatedAt = new Date().toISOString();
    await this.store.write(state);
    this.broadcast({ type: "terminal.updated", paneId, open });
    this.broadcast({ type: "workspace.layout.updated", layout: state.layout });
  }
}

