import * as React from "react";

import type { ServerEvent, ThreadSummary, WorkspaceBootstrapPayload, WorkspaceLayoutSnapshot } from "@hyprcode/contracts";
import { AppShell, MessageList, WorkspacePaneCard } from "@hyprcode/ui";

import { resolveApiConfig } from "../env";
import { createApi, type HyprcodeApi } from "../lib/api";
import { attachThreadToPane, focusPane as focusLayoutPane, setPaneTerminalOpen } from "../lib/workspaceLayout";

interface DashboardState {
  api: HyprcodeApi | null;
  bootstrap: WorkspaceBootstrapPayload | null;
  serverUrl: string | null;
  loading: boolean;
  error: string | null;
  codexStatus: {
    running: boolean;
    pid: number | null;
    lastError: string | null;
  } | null;
}

function updateThread(threads: ThreadSummary[], next: ThreadSummary) {
  const index = threads.findIndex((thread) => thread.id === next.id);
  if (index === -1) return [next, ...threads];
  const copy = [...threads];
  copy[index] = next;
  return copy;
}

export function WorkspaceDashboard() {
  const [state, setState] = React.useState<DashboardState>({
    api: null,
    bootstrap: null,
    serverUrl: null,
    loading: true,
    error: null,
    codexStatus: null,
  });
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const socketRef = React.useRef<WebSocket | null>(null);

  const reload = React.useCallback(async (api: HyprcodeApi) => {
    const [bootstrap, codexStatus] = await Promise.all([api.bootstrap(), api.codexStatus()]);
    React.startTransition(() => {
      setState((current) => ({
        ...current,
        bootstrap,
        codexStatus,
        loading: false,
        error: null,
      }));
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const config = await resolveApiConfig();
        const api = createApi(config.serverUrl);
        if (cancelled) return;
        setState((current) => ({ ...current, api, serverUrl: config.serverUrl }));
        await reload(api);
        const socket = api.connect((event: unknown) => {
          const payload = event as ServerEvent | { type: "connected" };
          React.startTransition(() => {
            setState((current) => {
              if (!current.bootstrap) return current;
              if (payload.type === "thread.updated") {
                return {
                  ...current,
                  bootstrap: {
                    ...current.bootstrap,
                    threads: updateThread(current.bootstrap.threads, payload.thread),
                  },
                };
              }
              if (payload.type === "workspace.layout.updated") {
                return {
                  ...current,
                  bootstrap: {
                    ...current.bootstrap,
                    layout: payload.layout,
                  },
                };
              }
              if (payload.type === "terminal.updated") {
                return {
                  ...current,
                  bootstrap: {
                    ...current.bootstrap,
                    layout: setPaneTerminalOpen(current.bootstrap.layout, payload.paneId, payload.open),
                  },
                };
              }
              return current;
            });
          });
        });
        socketRef.current = socket;
      } catch (error) {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
          loading: false,
        }));
      }
    }

    void boot();

    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [reload]);

  const bootstrap = state.bootstrap;
  const threads = bootstrap?.threads ?? [];
  const projects = bootstrap?.projects ?? [];
  const layout = bootstrap?.layout ?? null;

  const threadById = React.useMemo(() => new Map(threads.map((thread) => [thread.id, thread])), [threads]);
  const projectById = React.useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const persistLayout = React.useCallback(
    async (nextLayout: WorkspaceLayoutSnapshot) => {
      if (!state.api || !bootstrap) return;
      React.startTransition(() => {
        setState((current) =>
          current.bootstrap
            ? {
                ...current,
                bootstrap: {
                  ...current.bootstrap,
                  layout: nextLayout,
                },
              }
            : current,
        );
      });
      await state.api.saveLayout(nextLayout);
    },
    [bootstrap, state.api],
  );

  const createPane = React.useCallback(async () => {
    if (!state.api) return;
    await state.api.createPane();
    await reload(state.api);
  }, [reload, state.api]);

  const createThread = React.useCallback(
    async (projectId: string, paneId?: string) => {
      if (!state.api || !layout) return;
      const thread = await state.api.createThread(projectId);
      if (paneId) {
        const nextLayout = attachThreadToPane(layout, paneId, thread);
        await persistLayout(nextLayout);
      }
      await reload(state.api);
    },
    [layout, persistLayout, reload, state.api],
  );

  const onPaneFocus = React.useCallback(
    async (paneId: string) => {
      if (!layout || !state.api) return;
      const next = focusLayoutPane(layout, paneId);
      React.startTransition(() => {
        setState((current) =>
          current.bootstrap
            ? {
                ...current,
                bootstrap: {
                  ...current.bootstrap,
                  layout: next,
                },
              }
            : current,
        );
      });
      await state.api.focusPane(paneId);
    },
    [layout, state.api],
  );

  const sendMessage = React.useCallback(
    async (threadId: string, paneId: string) => {
      if (!state.api) return;
      const draft = drafts[paneId]?.trim();
      if (!draft) return;
      await state.api.sendMessage(threadId, draft);
      setDrafts((current) => ({ ...current, [paneId]: "" }));
    },
    [drafts, state.api],
  );

  if (state.loading) {
    return <div className="hc-loading">Loading HyprCode workspace...</div>;
  }

  if (state.error || !bootstrap || !layout) {
    return (
      <div className="hc-errorState">
        <h1>HyprCode could not load</h1>
        <p>{state.error ?? "Unknown startup error"}</p>
      </div>
    );
  }

  return (
    <AppShell
      header={
        <div className="hc-topbar">
          <div>
            <div className="hc-topbar__eyebrow">HyprCode Workspace</div>
            <h1>Codex sessions in a tiled dashboard</h1>
          </div>
          <div className="hc-topbar__actions">
            <div className="hc-runtimeChip">
              <span>{state.serverUrl}</span>
              <strong>{state.codexStatus?.running ? "Codex running" : "Codex idle"}</strong>
            </div>
            <button className="hc-button hc-button--ghost" type="button" onClick={() => void reload(state.api!)}>
              Refresh
            </button>
            <button className="hc-button" type="button" onClick={() => void createPane()}>
              Add pane
            </button>
          </div>
        </div>
      }
    >
      <div className="hc-dashboardIntro">
        <p>
          Two-column dashboard on wide screens, one column on narrow screens. Each pane stays bound to a project and
          thread without leaving the page.
        </p>
      </div>
      <div className="hc-grid">
        {layout.panes
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((pane) => {
            const thread = pane.threadId ? threadById.get(pane.threadId) ?? null : null;
            const project = pane.projectId ? projectById.get(pane.projectId) ?? null : null;
            const availableProjects = projects;
            const draft = drafts[pane.id] ?? "";

            return (
              <WorkspacePaneCard
                key={pane.id}
                pane={pane}
                thread={thread}
                project={project}
                focused={layout.focusedPaneId === pane.id}
                onFocus={() => void onPaneFocus(pane.id)}
                onRemove={() => void state.api?.deletePane(pane.id).then(() => reload(state.api!))}
                actions={
                  <>
                    <select
                      className="hc-select"
                      value={thread?.id ?? ""}
                      onChange={(event) => {
                        const selectedThread = threadById.get(event.target.value);
                        if (!selectedThread) return;
                        const next = attachThreadToPane(layout, pane.id, selectedThread);
                        void persistLayout(next);
                      }}
                    >
                      <option value="">Bind existing thread</option>
                      {threads.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                    <select
                      className="hc-select"
                      defaultValue={project?.id ?? availableProjects[0]?.id ?? ""}
                      onChange={(event) => void createThread(event.target.value, pane.id)}
                    >
                      {availableProjects.map((item) => (
                        <option key={item.id} value={item.id}>
                          New thread in {item.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="hc-button hc-button--ghost"
                      type="button"
                      onClick={() =>
                        pane.terminalOpen
                          ? void state.api?.closeTerminal(pane.id)
                          : void state.api?.openTerminal(pane.id)
                      }
                    >
                      {pane.terminalOpen ? "Hide terminal" : "Show terminal"}
                    </button>
                    {thread ? (
                      <button className="hc-button hc-button--ghost" type="button" onClick={() => void state.api?.resumeThread(thread.id)}>
                        Resume
                      </button>
                    ) : null}
                    {thread ? (
                      <button className="hc-button hc-button--ghost" type="button" onClick={() => void state.api?.closeThread(thread.id)}>
                        Close thread
                      </button>
                    ) : null}
                  </>
                }
              >
                <div className="hc-paneSummary">{thread?.summary ?? project?.summary ?? "Create or bind a thread to activate this pane."}</div>
                {thread ? <MessageList messages={thread.messages} /> : <div className="hc-emptyPane">No thread attached yet.</div>}
                {pane.terminalOpen ? <div className="hc-terminalStub">Terminal connected for {pane.id}</div> : null}
                <div className="hc-composer">
                  <textarea
                    className="hc-textarea"
                    placeholder={thread ? "Ask Codex to continue this thread..." : "Select or create a thread first"}
                    value={draft}
                    disabled={!thread}
                    onChange={(event) => setDrafts((current) => ({ ...current, [pane.id]: event.target.value }))}
                  />
                  <button
                    className="hc-button"
                    type="button"
                    disabled={!thread || draft.trim().length === 0}
                    onClick={() => thread && void sendMessage(thread.id, pane.id)}
                  >
                    Send
                  </button>
                </div>
              </WorkspacePaneCard>
            );
          })}
      </div>
    </AppShell>
  );
}
