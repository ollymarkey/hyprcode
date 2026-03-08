import type { ChatMessage, ProjectSummary, ThreadSummary, WorkspaceLayoutSnapshot } from "@hyprcode/contracts";

import { createId } from "@hyprcode/shared";

export interface ServerState {
  projects: ProjectSummary[];
  threads: ThreadSummary[];
  layout: WorkspaceLayoutSnapshot;
}

export function createSeedState(rootDir: string): ServerState {
  const now = new Date().toISOString();
  const projects: ProjectSummary[] = [
    {
      id: "project-hyprcode",
      name: "HyprCode",
      cwd: rootDir,
      branch: "main",
      worktree: null,
      summary: "Bootstrap monorepo and workspace dashboard.",
      color: "#ff7a59",
    },
    {
      id: "project-t3-reference",
      name: "t3code reference",
      cwd: `${rootDir}\\..\\t3code`,
      branch: "main",
      worktree: null,
      summary: "Reference patterns for React and Electron.",
      color: "#4da8ff",
    },
  ];

  const bootstrapMessages: ChatMessage[] = [
    {
      id: createId("msg"),
      role: "system",
      content: "HyprCode bootstrap workspace initialized.",
      createdAt: now,
    },
    {
      id: createId("msg"),
      role: "assistant",
      content: "Use this pane to drive the core dashboard and server bootstrap.",
      createdAt: now,
    },
  ];

  const designMessages: ChatMessage[] = [
    {
      id: createId("msg"),
      role: "assistant",
      content: "Use this pane to compare behavior against the t3code and opencode references.",
      createdAt: now,
    },
  ];

  const threads: ThreadSummary[] = [
    {
      id: "thread-bootstrap",
      projectId: projects[0]!.id,
      title: "Bootstrap HyprCode",
      summary: "Scaffold the monorepo and shared runtime contracts.",
      lastActivityAt: now,
      model: "gpt-5-codex",
      sessionState: "active",
      branch: projects[0]!.branch,
      worktree: projects[0]!.worktree,
      messages: bootstrapMessages,
    },
    {
      id: "thread-reference",
      projectId: projects[1]!.id,
      title: "Reference blending",
      summary: "Track ideas borrowed from t3code and opencode.",
      lastActivityAt: now,
      model: "gpt-5-codex",
      sessionState: "idle",
      branch: projects[1]!.branch,
      worktree: projects[1]!.worktree,
      messages: designMessages,
    },
  ];

  return {
    projects,
    threads,
    layout: {
      version: 1,
      columns: 2,
      focusedPaneId: "pane-1",
      updatedAt: now,
      panes: [
        {
          id: "pane-1",
          order: 0,
          threadId: threads[0]!.id,
          projectId: threads[0]!.projectId,
          focused: true,
          terminalOpen: false,
          collapsed: false,
          scrollTop: 0,
        },
        {
          id: "pane-2",
          order: 1,
          threadId: threads[1]!.id,
          projectId: threads[1]!.projectId,
          focused: false,
          terminalOpen: false,
          collapsed: false,
          scrollTop: 0,
        },
      ],
    },
  };
}
