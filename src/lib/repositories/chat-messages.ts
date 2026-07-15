import { and, asc, eq, isNull } from "drizzle-orm";

import { getDB } from "@/db";
import { chat_messages } from "@/db/schema";

type ChatMessageRow = typeof chat_messages.$inferSelect;
type ChatMessageInsert = typeof chat_messages.$inferInsert;

export async function createChatMessage(input: ChatMessageInsert): Promise<ChatMessageRow> {
  const [row] = await getDB().insert(chat_messages).values(input).returning();
  return row as ChatMessageRow;
}

export async function listChatMessagesBySession(sessionId: string): Promise<ChatMessageRow[]> {
  return getDB()
    .select()
    .from(chat_messages)
    .where(and(eq(chat_messages.session_id, sessionId), isNull(chat_messages.deleted_at)))
    .orderBy(asc(chat_messages.created_at));
}
