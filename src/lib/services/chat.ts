import { createChatSession, getChatSessionById } from "@/lib/repositories/chat-sessions";
import { createChatMessage, listChatMessagesBySession } from "@/lib/repositories/chat-messages";
import { NotFoundError } from "@/lib/errors";
import type { MessagePart, UIMessage } from "@tanstack/ai";

const TITLE_MAX_LENGTH = 60;
const SESSION_ID_UNIQUE_CONSTRAINT = /chat_sessions\.id/i;

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

  return createChatMessage({
    id: crypto.randomUUID(),
    session_id: sessionId,
    role,
    content: JSON.stringify(parts),
  });
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
