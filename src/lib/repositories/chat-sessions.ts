import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import { getDB } from "@/db";
import { chat_sessions } from "@/db/schema";
import { createSoftDeleteRepo } from "./soft-delete";

type ChatSessionRow = typeof chat_sessions.$inferSelect;
type ChatSessionInsert = typeof chat_sessions.$inferInsert;

export type ChatSessionCursor = { updated_at: Date; id: string };

const chatSessionRepo = createSoftDeleteRepo(chat_sessions);

export function createChatSession(input: ChatSessionInsert) {
  return chatSessionRepo.create(input);
}
export function getChatSessionById(userId: string, id: string) {
  return chatSessionRepo.getById(userId, id);
}
export function touchChatSession(userId: string, id: string) {
  // Explicit stamp rather than an empty patch — Drizzle throws on `.set({})`,
  // and this makes the Activity bump unambiguous at the call site.
  return chatSessionRepo.update(userId, id, { updated_at: new Date() });
}

export function approveSessionMutations(userId: string, id: string) {
  return chatSessionRepo.update(userId, id, { mutating_tools_approved: true });
}

/**
 * Keyset-paginated History listing: `updated_at desc` (most recent Chat Session
 * Activity first) with `id desc` as tie-breaker to make the sort total. Bespoke
 * on purpose — the generic soft-delete factory intentionally has no list method.
 */
export function listChatSessions(
  userId: string,
  opts: { cursor?: ChatSessionCursor; limit: number },
): Promise<ChatSessionRow[]> {
  const afterCursor = opts.cursor
    ? or(
        lt(chat_sessions.updated_at, opts.cursor.updated_at),
        and(
          eq(chat_sessions.updated_at, opts.cursor.updated_at),
          lt(chat_sessions.id, opts.cursor.id),
        ),
      )
    : undefined;

  return getDB()
    .select()
    .from(chat_sessions)
    .where(and(eq(chat_sessions.user_id, userId), isNull(chat_sessions.deleted_at), afterCursor))
    .orderBy(desc(chat_sessions.updated_at), desc(chat_sessions.id))
    .limit(opts.limit);
}
