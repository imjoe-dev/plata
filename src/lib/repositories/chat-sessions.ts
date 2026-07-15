import { chat_sessions } from "@/db/schema";
import { createSoftDeleteRepo } from "./soft-delete";

type ChatSessionInsert = typeof chat_sessions.$inferInsert;

const chatSessionRepo = createSoftDeleteRepo(chat_sessions);

export const createChatSession = (input: ChatSessionInsert) => chatSessionRepo.create(input);
export const getChatSessionById = (userId: string, id: string) =>
  chatSessionRepo.getById(userId, id);
