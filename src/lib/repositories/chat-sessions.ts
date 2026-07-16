import { chat_sessions } from "@/db/schema";
import { createSoftDeleteRepo } from "./soft-delete";

type ChatSessionInsert = typeof chat_sessions.$inferInsert;

const chatSessionRepo = createSoftDeleteRepo(chat_sessions);

export function createChatSession(input: ChatSessionInsert) {
  return chatSessionRepo.create(input);
}
export function getChatSessionById(userId: string, id: string) {
  return chatSessionRepo.getById(userId, id);
}
