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
import { AgentActivity } from "#/features/agents/components/agent-activity";
import { agentCommands, agentStore } from "#/features/agents/store";
import { cn } from "#/lib/utils";
import { measureChatComposerHeight } from "../lib/pretext-measure";
import { chatCommands, chatStore, createChatWindowState } from "../store";

type ChatWindowProps = {
  windowId: string;
  title: string;
  repoId: string;
};

const lexicalTheme = {
  paragraph: "mb-0",
};

export function ChatWindow({ windowId, title, repoId }: ChatWindowProps) {
  const chatWindow = useStore(
    chatStore,
    (state) => state[windowId] ?? createChatWindowState(windowId, title, repoId),
  );
  const agentWindow = useStore(agentStore, (state) => state.windows[windowId]);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [composerWidth, setComposerWidth] = useState(0);

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
                  const plainText = readPlainText(editorState);
                  const didSend = chatCommands.sendMessage(
                    windowId,
                    title,
                    repoId,
                    plainText,
                    JSON.stringify(editorState.toJSON()),
                  );

                  if (!didSend) {
                    return;
                  }

                  editor.update(() => {
                    $getRoot().clear();
                  });
                  chatCommands.setDraft(windowId, title, repoId, "", undefined);
                  void agentCommands.sendPrompt(windowId, title, repoId, plainText);
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 px-1 pb-1">
              <p className="text-[11px] text-muted-foreground">
                Enter to send. Shift+Enter for a new line.
              </p>
              <SendButton
                onSend={(editor, editorState) => {
                  const plainText = readPlainText(editorState);
                  const didSend = chatCommands.sendMessage(
                    windowId,
                    title,
                    repoId,
                    plainText,
                    JSON.stringify(editorState.toJSON()),
                  );

                  if (!didSend) {
                    return;
                  }

                  editor.update(() => {
                    $getRoot().clear();
                  });
                  chatCommands.setDraft(windowId, title, repoId, "", undefined);
                  void agentCommands.sendPrompt(windowId, title, repoId, plainText);
                }}
              />
            </div>
          </div>
        </LexicalComposer>
      </div>
      <AgentActivity windowId={windowId} agentWindow={agentWindow} />
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
