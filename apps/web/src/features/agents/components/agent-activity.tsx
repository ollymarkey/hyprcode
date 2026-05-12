import { AlertTriangle, Bot, Check, Loader2, Square, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { agentCommands } from "../store";
import type { AgentWindowState } from "../types";

type AgentActivityProps = {
  windowId: string;
  agentWindow?: AgentWindowState;
};

export function AgentActivity({ windowId, agentWindow }: AgentActivityProps) {
  if (!agentWindow?.sessionId) {
    return null;
  }

  const pendingApproval = Object.values(agentWindow.approvals).find(
    (approval) => approval.status === "pending",
  );
  const activePreview = agentWindow.activePreviewId
    ? agentWindow.previews[agentWindow.activePreviewId]
    : undefined;
  const latestStatus = [...agentWindow.events].reverse().find((event) => event.type === "status");

  return (
    <div className="border-t border-border bg-background/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {agentWindow.status === "running" ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          ) : (
            <Bot className="size-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Pi {agentWindow.status.replace("_", " ")}
            </p>
            <p className="truncate text-sm text-foreground">
              {latestStatus?.type === "status" ? latestStatus.label : "Session connected"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => void agentCommands.abortWindow(windowId)}
          title="Abort active Pi run"
        >
          <Square className="size-4" />
        </Button>
      </div>

      {activePreview && (
        <div className="mt-2 rounded-lg border border-border bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium">{activePreview.title}</p>
            <span className="rounded bg-muted px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {activePreview.kind}
            </span>
          </div>
          {"files" in activePreview && (
            <p className="mb-2 truncate text-xs text-muted-foreground">
              {activePreview.files.join(", ")}
            </p>
          )}
          <pre className="max-h-40 overflow-auto rounded bg-black/30 p-2 text-xs leading-5 text-muted-foreground">
            {"diff" in activePreview
              ? activePreview.diff
              : "output" in activePreview
                ? activePreview.output
                : "content" in activePreview
                  ? activePreview.content
                  : activePreview.detail}
          </pre>
        </div>
      )}

      {pendingApproval && (
        <div className="mt-2 rounded-lg border border-primary/30 bg-primary/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{pendingApproval.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {pendingApproval.description}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8", "border-border")}
              onClick={() =>
                void agentCommands.resolveApproval(windowId, pendingApproval.id, "denied")
              }
            >
              <X className="size-4" />
              Deny
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={() =>
                void agentCommands.resolveApproval(windowId, pendingApproval.id, "approved")
              }
            >
              <Check className="size-4" />
              Approve
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
