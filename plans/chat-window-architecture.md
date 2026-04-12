# Chat Window Architecture Plan

## Goal

Implement chat as the default hyprcode window type using `@lexical/react` for the composer and `@chenglou/pretext` for accurate text measurement, while keeping the UI minimal, sleek, and aligned with the existing workspace command model.

## Core Decisions

- Keep workspace layout and chat content in separate feature modules.
- Use Lexical for the chat composer first rather than building a custom editor surface.
- Use Pretext first for composer height measurement, then extend it later to transcript virtualization and richer layout work.
- Keep terminal and editor windows as lightweight placeholders until their dedicated implementations land.

## State Model

Split chat state into two parts.

### Serializable Chat Data

- chat windows keyed by `windowId`
- ordered messages
- message role and content
- plain text draft
- serialized Lexical draft state

### Ephemeral UI Data

- local composer width measurement
- local Lexical editor instance
- future streaming and selection UI state

The workspace store continues owning layout, focus, fullscreen, drag, and resize commands.

## Component Structure

- `src/features/workspaces/components/window-body.tsx` selects the body for each window type.
- `src/features/chat/components/chat-window.tsx` renders the transcript and composer.
- `src/features/chat/store.ts` owns serializable chat state and commands.
- `src/features/chat/lib/pretext-measure.ts` wraps Pretext sizing behavior for the composer.

## Lexical Integration

- Use `LexicalComposer` per chat window.
- Use a minimal plugin set: plain text plugin, history plugin, change plugin, and a small submit plugin.
- Keep `Enter` as submit and `Shift+Enter` as newline.
- Persist only serializable editor output, not editor instances.

## Pretext Integration

- Measure the composer draft with `prepare()` and `layout()` using `whiteSpace: "pre-wrap"`.
- Clamp composer height to a compact min size and a scrollable max size.
- Recompute measurement when text or available width changes.
- Keep the measurement wrapper resilient with a fallback path for tests and non-browser contexts.

## Default Chat Behavior

- Seed chat state for chat windows when they are created.
- Make new workspaces start with a chat window by default.
- Keep the chat action visually primary in the workspace top bar.

## Testing

- Test chat store commands for initialization, drafts, message send, and cleanup.
- Test Pretext measurement wrapper clamp behavior with injected stubs.
- Keep workspace layout tests unchanged except where chat initialization affects setup.

## Rollout Order

1. Update `AGENTS.md`
2. Add this tracked plan
3. Add chat state and commands
4. Add a shared window body renderer
5. Implement the chat transcript and Lexical composer
6. Add Pretext-backed auto-sizing
7. Verify with tests, formatting, and linting
