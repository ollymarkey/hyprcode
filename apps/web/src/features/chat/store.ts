import { Store } from "@tanstack/react-store";
import type { ChatMessage, ChatState, ChatWindowState } from "./types";

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

export function createChatWindowState(
  windowId: string,
  title: string,
  repoId: string,
): ChatWindowState {
  return {
    windowId,
    title,
    repoId,
    messages: [createAssistantWelcomeMessage(title, repoId)],
    draftPlainText: "",
  };
}

export const chatStore = new Store<ChatState>({});

export const chatCommands = {
  ensureWindow(windowId: string, title: string, repoId: string) {
    chatStore.setState((state) => {
      if (state[windowId]) {
        return state;
      }

      return {
        ...state,
        [windowId]: createChatWindowState(windowId, title, repoId),
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

  createPendingAssistantMessage(windowId: string, title: string, repoId: string) {
    const messageId = createMessageId();

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
              id: messageId,
              role: "assistant",
              content: "",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      };
    });

    return messageId;
  },

  appendAssistantDelta(windowId: string, messageId: string, delta: string) {
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
            message.id === messageId && message.role === "assistant"
              ? {
                  ...message,
                  content: `${message.content}${delta}`,
                }
              : message,
          ),
        },
      };
    });
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

  reset() {
    chatStore.setState(() => ({}));
  },
};
