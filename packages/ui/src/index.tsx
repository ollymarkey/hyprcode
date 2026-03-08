import * as React from "react";

import { formatRelativeTimestamp } from "@hyprcode/shared";
import type { ProjectSummary, RuntimeSessionState, ThreadSummary, WorkspacePane } from "@hyprcode/contracts";

const statusLabels: Record<RuntimeSessionState, string> = {
  connecting: "Connecting",
  active: "Active",
  waiting_approval: "Approval",
  waiting_input: "Input",
  idle: "Idle",
  error: "Error",
  closed: "Closed",
};

export function AppShell(props: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="hc-shell">
      <div className="hc-shell__header">{props.header}</div>
      <div className="hc-shell__body">{props.children}</div>
    </div>
  );
}

export function StatusBadge(props: { state: RuntimeSessionState }) {
  return <span className={`hc-badge hc-badge--${props.state}`}>{statusLabels[props.state]}</span>;
}

export function WorkspacePaneCard(props: {
  pane: WorkspacePane;
  thread: ThreadSummary | null;
  project: ProjectSummary | null;
  focused: boolean;
  onFocus: () => void;
  onRemove: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const latestActivity = props.thread ? formatRelativeTimestamp(props.thread.lastActivityAt) : "No thread";

  return (
    <section className={`hc-pane ${props.focused ? "is-focused" : ""}`} onClick={props.onFocus}>
      <header className="hc-pane__header">
        <div>
          <div className="hc-pane__eyebrow">{props.project?.name ?? "Unassigned pane"}</div>
          <h2 className="hc-pane__title">{props.thread?.title ?? "Empty workspace pane"}</h2>
          <p className="hc-pane__meta">{props.project?.cwd ?? "Bind this pane to a project to start"}</p>
        </div>
        <div className="hc-pane__headerRight">
          {props.thread ? <StatusBadge state={props.thread.sessionState} /> : null}
          <button className="hc-iconButton" type="button" onClick={(event) => {
            event.stopPropagation();
            props.onRemove();
          }}>
            Close
          </button>
        </div>
      </header>
      <div className="hc-pane__subheader">
        <span>{props.thread?.model ?? "No model"}</span>
        <span>{props.project?.branch ?? props.thread?.branch ?? "No branch"}</span>
        <span>{props.project?.worktree ?? props.thread?.worktree ?? "No worktree"}</span>
        <span>{latestActivity}</span>
      </div>
      {props.actions ? <div className="hc-pane__actions">{props.actions}</div> : null}
      <div className="hc-pane__body">{props.children}</div>
    </section>
  );
}

export function MessageList(props: { messages: ThreadSummary["messages"] }) {
  return (
    <div className="hc-messages">
      {props.messages.map((message) => (
        <article key={message.id} className={`hc-message hc-message--${message.role}`}>
          <div className="hc-message__role">{message.role}</div>
          <p>{message.content}</p>
        </article>
      ))}
    </div>
  );
}
