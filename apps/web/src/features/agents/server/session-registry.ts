import type { AgentSessionMetadata, NormalizedAgentEvent } from "../types";

type AgentSessionRecord = {
  metadata: AgentSessionMetadata;
  events: NormalizedAgentEvent[];
  piSession?: unknown;
  abortController?: AbortController;
  unsubscribePi?: () => void;
};

type AgentSessionListener = (event: NormalizedAgentEvent) => void;

export class PiSessionRegistry {
  readonly #sessions = new Map<string, AgentSessionRecord>();
  readonly #listeners = new Map<string, Set<AgentSessionListener>>();

  create(metadata: AgentSessionMetadata, piSession?: unknown) {
    const record: AgentSessionRecord = {
      metadata,
      piSession,
      events: [],
    };

    this.#sessions.set(metadata.id, record);
    return record;
  }

  get(sessionId: string) {
    return this.#sessions.get(sessionId);
  }

  appendEvent(event: NormalizedAgentEvent) {
    const record = this.#sessions.get(event.sessionId);

    if (!record) {
      return;
    }

    record.events.push(event);
    record.events = record.events.slice(-200);

    this.#listeners.get(event.sessionId)?.forEach((listener) => listener(event));
  }

  subscribe(sessionId: string, listener: AgentSessionListener) {
    const listeners = this.#listeners.get(sessionId) ?? new Set<AgentSessionListener>();
    listeners.add(listener);
    this.#listeners.set(sessionId, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.#listeners.delete(sessionId);
      }
    };
  }

  updateMetadata(sessionId: string, metadata: Partial<AgentSessionMetadata>) {
    const record = this.#sessions.get(sessionId);

    if (!record) {
      return;
    }

    record.metadata = {
      ...record.metadata,
      ...metadata,
      updatedAt: new Date().toISOString(),
    };
  }

  delete(sessionId: string) {
    this.#sessions.get(sessionId)?.unsubscribePi?.();
    this.#listeners.delete(sessionId);
    return this.#sessions.delete(sessionId);
  }
}

export const piSessionRegistry = new PiSessionRegistry();
