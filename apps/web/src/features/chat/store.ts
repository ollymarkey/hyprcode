import { Store } from "@tanstack/react-store";
import { scheduleWorkspaceSessionPersist } from "#/features/workspaces/session-persistence";
import type {
  AgentProvider,
  ChatMessage,
  ChatRuntimeSettings,
  ChatState,
  ChatWindowState,
  ReasoningEffort,
} from "./types";

function createMessageId(): string {
  return globalThis.crypto.randomUUID();
}

function createAssistantWelcomeMessage(title: string, repoId: string): ChatMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    content: `Ready to work in ${title}. Repository context is ${repoId}.`,
    createdAt: new Date().toISOString(),
  };
}

export const defaultChatRuntimeSettings: ChatRuntimeSettings = {
  harness: "codex",
  reasoningEffort: "medium",
};

function normalizeRuntimeSettings(settings: Partial<ChatRuntimeSettings>): ChatRuntimeSettings {
  return {
    ...defaultChatRuntimeSettings,
    ...settings,
    harness: settings.harness === "opencode" ? "opencode" : "codex",
    model: settings.model || undefined,
  };
}

export function createChatWindowState(
  windowId: string,
  title: string,
  repoId: string,
  settings: Partial<ChatRuntimeSettings> = {},
  messages?: ChatMessage[],
): ChatWindowState {
  return {
    windowId,
    title,
    repoId,
    settings: normalizeRuntimeSettings(settings),
    messages: messages ?? [createAssistantWelcomeMessage(title, repoId)],
    draftPlainText: "",
  };
}

export const chatStore = new Store<ChatState>({});

export const chatCommands = {
  ensureWindow(
    windowId: string,
    title: string,
    repoId: string,
    settings?: Partial<ChatRuntimeSettings>,
    messages?: ChatMessage[],
  ) {
    chatStore.setState((state) => {
      if (state[windowId]) {
        return state;
      }

      return {
        ...state,
        [windowId]: createChatWindowState(windowId, title, repoId, settings, messages),
      };
    });
  },

  setDraft(
    windowId: string,
    title: string,
    repoId: string,
    draftPlainText: string,
    draftEditorState?: string,
  ) {
    chatStore.setState((state) => {
      const currentWindow = state[windowId] ?? createChatWindowState(windowId, title, repoId);

      return {
        ...state,
        [windowId]: {
          ...currentWindow,
          title,
          repoId,
          draftPlainText,
          draftEditorState,
        },
      };
    });
  },

  sendMessage(
    windowId: string,
    title: string,
    repoId: string,
    content: string,
    serializedEditorState?: string,
  ) {
    const normalizedContent = content.trim();

    if (!normalizedContent) {
      return false;
    }

    chatStore.setState((state) => {
      const currentWindow = state[windowId] ?? createChatWindowState(windowId, title, repoId);

      return {
        ...state,
        [windowId]: {
          ...currentWindow,
          title,
          repoId,
          messages: [
            ...currentWindow.messages,
            {
              id: createMessageId(),
              role: "user",
              content: normalizedContent,
              createdAt: new Date().toISOString(),
              serializedEditorState,
            },
          ],
          draftPlainText: "",
          draftEditorState: undefined,
        },
      };
    });

    return true;
  },

  startAssistantMessage(windowId: string, title: string, repoId: string, messageId: string) {
    chatStore.setState((state) => {
      const currentWindow = state[windowId] ?? createChatWindowState(windowId, title, repoId);

      if (currentWindow.messages.some((message) => message.id === messageId)) {
        return state;
      }

      return {
        ...state,
        [windowId]: {
          ...currentWindow,
          title,
          repoId,
          messages: [
            ...currentWindow.messages,
            {
              id: messageId,
              role: "assistant",
              content: "",
              createdAt: new Date().toISOString(),
              isStreaming: true,
            },
          ],
        },
      };
    });
  },

  appendAssistantMessage(
    windowId: string,
    title: string,
    repoId: string,
    messageId: string,
    contentDelta: string,
  ) {
    if (!contentDelta) {
      return;
    }

    chatStore.setState((state) => {
      const currentWindow = state[windowId] ?? createChatWindowState(windowId, title, repoId);
      const hasMessage = currentWindow.messages.some((message) => message.id === messageId);
      const nextMessages = hasMessage
        ? currentWindow.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  content: `${message.content}${contentDelta}`,
                  isStreaming: true,
                }
              : message,
          )
        : [
            ...currentWindow.messages,
            {
              id: messageId,
              role: "assistant" as const,
              content: contentDelta,
              createdAt: new Date().toISOString(),
              isStreaming: true,
            },
          ];

      return {
        ...state,
        [windowId]: {
          ...currentWindow,
          title,
          repoId,
          messages: nextMessages,
        },
      };
    });
  },

  finishAssistantMessage(windowId: string, messageId: string) {
    chatStore.setState((state) => {
      const currentWindow = state[windowId];

      if (!currentWindow) {
        return state;
      }

      return {
        ...state,
        [windowId]: {
          ...currentWindow,
          messages: currentWindow.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  isStreaming: false,
                }
              : message,
          ),
        },
      };
    });
  },

  failAssistantMessage(
    windowId: string,
    title: string,
    repoId: string,
    messageId: string,
    errorMessage: string,
  ) {
    chatCommands.appendAssistantMessage(
      windowId,
      title,
      repoId,
      messageId,
      `\n\nServer error: ${errorMessage}`,
    );
    chatCommands.finishAssistantMessage(windowId, messageId);
  },

  removeWindow(windowId: string) {
    chatStore.setState((state) => {
      if (!state[windowId]) {
        return state;
      }

      const nextState = { ...state };
      delete nextState[windowId];
      return nextState;
    });
  },

  renameWindow(windowId: string, newTitle: string) {
    chatStore.setState((state) => {
      const window = state[windowId];

      if (!window) {
        return state;
      }

      return {
        ...state,
        [windowId]: {
          ...window,
          title: newTitle,
        },
      };
    });
  },

  setRepoContext(windowId: string, repoId: string) {
    chatStore.setState((state) => {
      const window = state[windowId];

      if (!window) {
        return state;
      }

      return {
        ...state,
        [windowId]: {
          ...window,
          repoId,
        },
      };
    });
  },

  setRuntimeSettings(windowId: string, settings: Partial<ChatRuntimeSettings>) {
    chatStore.setState((state) => {
      const window = state[windowId];

      if (!window) {
        return state;
      }

      return {
        ...state,
        [windowId]: {
          ...window,
          settings: normalizeRuntimeSettings({
            ...window.settings,
            ...settings,
            model: settings.model === "" ? undefined : (settings.model ?? window.settings.model),
          }),
        },
      };
    });

    scheduleWorkspaceSessionPersist();
  },

  setHarness(windowId: string, harness: AgentProvider) {
    chatCommands.setRuntimeSettings(windowId, { harness });
  },

  setReasoningEffort(windowId: string, reasoningEffort: ReasoningEffort) {
    chatCommands.setRuntimeSettings(windowId, { reasoningEffort });
  },

  setHarnessSessionId(windowId: string, harnessSessionId?: string) {
    chatCommands.setRuntimeSettings(windowId, { harnessSessionId });
  },

  replaceMessages(windowId: string, messages: ChatMessage[]) {
    chatStore.setState((state) => {
      const window = state[windowId];

      if (!window) {
        return state;
      }

      return {
        ...state,
        [windowId]: {
          ...window,
          messages: messages.length > 0 ? messages : window.messages,
        },
      };
    });
  },

  reset() {
    chatStore.setState(() => ({}));
  },
};
