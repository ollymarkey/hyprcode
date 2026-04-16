import { MessageSquareDashed } from "lucide-react";
import { ChatWindow } from "#/features/chat/components/chat-window";
import type { WorkspaceWindow } from "../types";

export function WindowBody({ window }: { window: WorkspaceWindow }) {
  switch (window.type) {
    case "chat":
      return <ChatWindow windowId={window.id} title={window.title} repoId={window.repoId} />;
    case "terminal":
      return <WindowPlaceholder label="Terminal" description="Terminal windows land after chat." />;
    case "editor":
      return <WindowPlaceholder label="Editor" description="Editor windows land after chat." />;
    default:
      return null;
  }
}

function WindowPlaceholder({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-muted px-4 py-6 text-center">
      <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-6 text-muted-foreground">
        <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-foreground">
          <MessageSquareDashed className="size-4" />
          {label}
        </div>
        <p className="text-sm leading-6">{description}</p>
      </div>
    </div>
  );
}
