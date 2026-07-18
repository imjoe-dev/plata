import {
  createChatSession,
  getChatSessionById,
  listChatSessions,
  touchChatSession,
  type ChatSessionCursor,
} from "@/lib/repositories/chat-sessions";
import { createChatMessage, listChatMessagesBySession } from "@/lib/repositories/chat-messages";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { MessagePart, UIMessage } from "@tanstack/ai";

const TITLE_MAX_LENGTH = 60;
const SESSION_ID_UNIQUE_CONSTRAINT = /chat_sessions\.id/i;
const LIST_LIMIT_DEFAULT = 20;
const LIST_LIMIT_MAX = 50;

export function deriveTitle(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;

  const truncated = trimmed.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}…`;
}

function extractPlainText(parts: MessagePart[]): string {
  return parts
    .filter((part): part is Extract<MessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.content)
    .join("");
}

export async function getOrCreateSession(
  userId: string,
  sessionId: string,
  firstMessageParts: MessagePart[],
) {
  const existing = await getChatSessionById(userId, sessionId);
  if (existing) return existing;

  try {
    const row = await createChatSession({
      id: sessionId,
      user_id: userId,
      title: deriveTitle(extractPlainText(firstMessageParts)),
    });
    return row;
  } catch (cause) {
    if (cause instanceof Error && SESSION_ID_UNIQUE_CONSTRAINT.test(cause.message)) {
      // A concurrent request for the same session id won the race. If it was this same
      // user double-submitting (e.g. a network retry), the row is now visible under their
      // own scope — treat that as the idempotent success case, not an ownership conflict.
      const wonByCaller = await getChatSessionById(userId, sessionId);
      if (wonByCaller) return wonByCaller;
      throw new NotFoundError("chat_session", sessionId);
    }
    throw cause;
  }
}

export async function appendMessage(
  userId: string,
  sessionId: string,
  role: "user" | "assistant",
  parts: MessagePart[],
) {
  const session = await getChatSessionById(userId, sessionId);
  if (!session) throw new NotFoundError("chat_session", sessionId);

  const message = await createChatMessage({
    id: crypto.randomUUID(),
    session_id: sessionId,
    role,
    content: JSON.stringify(parts),
  });
  // Appending counts as Chat Session Activity: touch the parent row so the
  // session's recency advances and it reorders to the top of History.
  await touchChatSession(userId, sessionId);
  return message;
}

export type ChatSessionListItem = { id: string; title: string; updated_at: Date };
export type ChatSessionList = { items: ChatSessionListItem[]; next_cursor: string | null };

// The cursor is opaque to clients by design: base64 of `<updated_at_ms>:<id>`.
// The encoding can change server-side without a contract break.
function encodeCursor(cursor: ChatSessionCursor): string {
  return btoa(`${cursor.updated_at.getTime()}:${cursor.id}`);
}

function invalidCursor(): ValidationError {
  return new ValidationError({ cursor: ["Malformed cursor"] });
}

function decodeCursor(cursor: string): ChatSessionCursor {
  let decoded: string;
  try {
    decoded = atob(cursor);
  } catch {
    throw invalidCursor();
  }
  const separator = decoded.indexOf(":");
  if (separator <= 0) throw invalidCursor();
  const ms = Number(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (!Number.isSafeInteger(ms) || id.length === 0) throw invalidCursor();
  return { updated_at: new Date(ms), id };
}

export async function listSessions(
  userId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<ChatSessionList> {
  const limit = Math.min(opts.limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);
  const cursor = opts.cursor === undefined ? undefined : decodeCursor(opts.cursor);

  // Fetch one extra row: its presence means another page exists.
  const rows = await listChatSessions(userId, { cursor, limit: limit + 1 });
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return {
    items: page.map((row) => ({ id: row.id, title: row.title, updated_at: row.updated_at })),
    next_cursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}

export async function listMessages(userId: string, sessionId: string): Promise<UIMessage[]> {
  const session = await getChatSessionById(userId, sessionId);
  if (!session) throw new NotFoundError("chat_session", sessionId);

  const rows = await listChatMessagesBySession(sessionId);
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: JSON.parse(row.content) as MessagePart[],
  }));
}
