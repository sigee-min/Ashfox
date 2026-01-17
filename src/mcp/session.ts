import { SseConnection } from './types';

export type McpSession = {
  id: string;
  protocolVersion: string;
  initialized: boolean;
  createdAt: number;
  lastSeenAt: number;
  sseConnections: Set<SseConnection>;
};

export class SessionStore {
  private readonly sessions = new Map<string, McpSession>();

  create(id: string, protocolVersion: string): McpSession {
    const now = Date.now();
    const session: McpSession = {
      id,
      protocolVersion,
      initialized: false,
      createdAt: now,
      lastSeenAt: now,
      sseConnections: new Set()
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): McpSession | null {
    return this.sessions.get(id) ?? null;
  }

  touch(session: McpSession) {
    session.lastSeenAt = Date.now();
  }

  attachSse(session: McpSession, connection: SseConnection) {
    session.sseConnections.add(connection);
  }

  detachSse(session: McpSession, connection: SseConnection) {
    session.sseConnections.delete(connection);
  }

  close(session: McpSession) {
    for (const conn of session.sseConnections) {
      conn.close();
    }
    session.sseConnections.clear();
    this.sessions.delete(session.id);
  }
}
