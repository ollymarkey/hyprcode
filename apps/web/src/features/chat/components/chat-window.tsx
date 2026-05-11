import { useEffect, useMemo, useRef, useState } from "react";
import {
  $getRoot,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { useStore } from "@tanstack/react-store";
import { ArrowUp, MessageSquareDashed } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { cn } from "#/lib/utils";
import { runAgentPrompt, subscribeToAgentStream } from "../agent-client";
import { measureChatComposerHeight } from "../lib/pretext-measure";
import { loadAgents, type HarnessAgentInfo } from "#/features/workspaces/session-persistence";
import { chatCommands, chatStore, createChatWindowState } from "../store";
import type { AgentProvider, ReasoningEffort } from "../types";

type ChatWindowProps = {
  windowId: string;
  title: string;
  repoId: string;
  cwd?: string;
};

const lexicalTheme = {
  paragraph: "mb-0",
};

const fallbackAgents: HarnessAgentInfo[] = [
  { id: "codex", name: "codex" },
  { id: "opencode", name: "opencode" },
];

const reasoningOptions: ReasoningEffort[] = ["none", "minimal", "low", "medium", "high", "xhigh"];

export function ChatWindow({ windowId, title, repoId, cwd }: ChatWindowProps) {
  const chatWindow = useStore(
    chatStore,
    (state) => state[windowId] ?? createChatWindowState(windowId, title, repoId),
  );
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [composerWidth, setComposerWidth] = useState(0);
  const [agents, setAgents] = useState<HarnessAgentInfo[]>(fallbackAgents);

  useEffect(() => {
    return subscribeToAgentStream(windowId, {
      onRunStarted(message) {
        chatCommands.startAssistantMessage(windowId, title, repoId, message.assistantMessageId);
      },
      onStreamEvent(message) {
        const event = message.event;

        if (event.type === "text") {
          chatCommands.appendAssistantMessage(
            windowId,
            title,
            repoId,
            message.assistantMessageId,
            event.text,
          );
          return;
        }

        if (event.type === "message" && event.role === "assistant") {
          chatCommands.appendAssistantMessage(
            windowId,
            title,
            repoId,
            message.assistantMessageId,
            event.content,
          );
        }
      },
      onRunCompleted(message) {
        chatCommands.finishAssistantMessage(windowId, message.assistantMessageId);
      },
      onRunFailed(message) {
        chatCommands.failAssistantMessage(
          windowId,
          title,
          repoId,
          message.assistantMessageId ?? crypto.randomUUID(),
          message.message,
        );
      },
    });
  }, [repoId, title, windowId]);

  useEffect(() => {
    let isCancelled = false;

    void loadAgents()
      .then((nextAgents) => {
        if (!isCancelled && nextAgents.length > 0) {
          setAgents(nextAgents);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setAgents(fallbackAgents);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const composerElement = composerRef.current;

    if (!composerElement || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setComposerWidth(Math.floor(nextWidth));
    });

    observer.observe(composerElement);
    setComposerWidth(Math.floor(composerElement.getBoundingClientRect().width));

    return () => observer.disconnect();
  }, []);

  const composerHeight = useMemo(
    () => measureChatComposerHeight(chatWindow.draftPlainText, composerWidth),
    [chatWindow.draftPlainText, composerWidth],
  );

  const initialConfig = useMemo(
    () => ({
      namespace: `hyprcode-chat-${windowId}`,
      onError(error: Error) {
        throw error;
      },
      theme: lexicalTheme,
      editorState: chatWindow.draftEditorState,
    }),
    [chatWindow.draftEditorState, windowId],
  );

  function submitPrompt(editor: LexicalEditor, editorState: EditorState) {
    const prompt = readPlainText(editorState);
    const didSend = chatCommands.sendMessage(
      windowId,
      title,
      repoId,
      prompt,
      JSON.stringify(editorState.toJSON()),
    );

    if (!didSend) {
      return;
    }

    runAgentPrompt({
      windowId,
      title,
      repoId,
      prompt: prompt.trim(),
      cwd: cwd ?? getPathLikeCwd(repoId),
      agent: chatWindow.settings.harness,
      model: chatWindow.settings.model,
      reasoningEffort: chatWindow.settings.reasoningEffort,
      sessionId: chatWindow.settings.harnessSessionId,
    });

    editor.update(() => {
      $getRoot().clear();
    });
    chatCommands.setDraft(windowId, title, repoId, "", undefined);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {chatWindow.messages.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3">
            {chatWindow.messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <article
                  key={message.id}
                  className={cn(
                    "max-w-[88%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_10px_30px_rgba(0,0,0,0.16)]",
                    isUser
                      ? "ml-auto bg-primary/15 text-foreground ring-1 ring-primary/20"
                      : "bg-muted text-foreground ring-1 ring-border",
                  )}
                >
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {message.role}
                  </p>
                  <p className="break-word whitespace-pre-wrap">{message.content}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageSquareDashed className="size-4" />
              Start the conversation.
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <LexicalComposer initialConfig={initialConfig}>
          <div className="rounded-2xl border border-border bg-muted p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div ref={composerRef} className="relative min-h-11">
              <PlainTextPlugin
                contentEditable={
                  <ContentEditable
                    className="chat-editor-input overflow-y-auto px-3 py-3 text-sm leading-5 text-foreground outline-none"
                    style={{ height: composerHeight }}
                  />
                }
                placeholder={
                  <div className="pointer-events-none absolute inset-x-3 top-3 text-sm text-muted-foreground">
                    Message {title.toLowerCase()}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <OnChangePlugin
                ignoreSelectionChange
                onChange={(editorState) => {
                  chatCommands.setDraft(
                    windowId,
                    title,
                    repoId,
                    readPlainText(editorState),
                    JSON.stringify(editorState.toJSON()),
                  );
                }}
              />
              <SubmitOnEnterPlugin
                onSubmit={(editor, editorState) => {
                  submitPrompt(editor, editorState);
                }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
              <ChatRuntimeControls windowId={windowId} agents={agents} />
              <p className="min-w-32 flex-1 text-center text-[11px] text-muted-foreground">
                Enter to send. Shift+Enter for a new line.
              </p>
              <SendButton
                onSend={(editor, editorState) => {
                  submitPrompt(editor, editorState);
                }}
              />
            </div>
          </div>
        </LexicalComposer>
      </div>
    </div>
  );
}

function getPathLikeCwd(repoId: string): string | undefined {
  const trimmed = repoId.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("/") || trimmed.startsWith("~") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

function ChatRuntimeControls({
  windowId,
  agents,
}: {
  windowId: string;
  agents: HarnessAgentInfo[];
}) {
  const settings = useStore(
    chatStore,
    (state) =>
      state[windowId]?.settings ?? {
        harness: "codex" as AgentProvider,
        reasoningEffort: "medium" as ReasoningEffort,
      },
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        value={settings.harness}
        onValueChange={(value) => chatCommands.setHarness(windowId, value as AgentProvider)}
      >
        <SelectTrigger size="sm" className="h-7 max-w-28 border-border bg-background px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={settings.reasoningEffort}
        onValueChange={(value) =>
          chatCommands.setReasoningEffort(windowId, value as ReasoningEffort)
        }
      >
        <SelectTrigger size="sm" className="h-7 max-w-28 border-border bg-background px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {reasoningOptions.map((reasoning) => (
            <SelectItem key={reasoning} value={reasoning}>
              {reasoning}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function readPlainText(editorState: EditorState): string {
  return editorState.read(() => $getRoot().getTextContent());
}

function SubmitOnEnterPlugin({
  onSubmit,
}: {
  onSubmit: (editor: LexicalEditor, editorState: EditorState) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!event) {
          return false;
        }

        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
          return false;
        }

        event.preventDefault();
        onSubmit(editor, editor.getEditorState());
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onSubmit]);

  return null;
}

function SendButton({
  onSend,
}: {
  onSend: (editor: LexicalEditor, editorState: EditorState) => void;
}) {
  const [editor] = useLexicalComposerContext();

  return (
    <Button
      size="sm"
      className="h-8 rounded-full px-3"
      onClick={() => onSend(editor, editor.getEditorState())}
    >
      <ArrowUp className="size-4" />
      Send
    </Button>
  );
}
