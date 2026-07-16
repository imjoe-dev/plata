import {
  chat,
  chatParamsFromRequestBody,
  convertMessagesToModelMessages,
  modelMessageToUIMessage,
  modelMessagesToUIMessages,
  toServerSentEventsResponse,
  type ChatMiddleware,
} from "@tanstack/ai";
import { createOpenaiChat, openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import type { ToolContext } from "@/lib/ai/tools/context";
import { allToolDefinitions } from "@/lib/ai/tools/index";
import { checkRateLimit, requireUser, toErrorResponse } from "@/lib/api/http";
import { appendMessage, getOrCreateSession } from "@/lib/services/chat";

const SUPPORTED_MODELS = ["gpt-5.4-mini"] as const;
type SupportedModel = (typeof SUPPORTED_MODELS)[number];

const adapters: Record<SupportedModel, ReturnType<typeof openaiText>> = {
  "gpt-5.4-mini": createOpenaiChat("gpt-5.4-mini", env.OPENAI_API_KEY),
};

const chatForwardedPropsSchema = z.object({
  model_id: z.enum(SUPPORTED_MODELS),
  session_id: z.uuid(),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await requireUser(request);
          await checkRateLimit(env.CHAT_RATE_LIMITER, userId);

          const body = await request.json();
          const { messages, forwardedProps } = await chatParamsFromRequestBody(body);
          const { model_id, session_id } = chatForwardedPropsSchema.parse(forwardedProps ?? {});

          const normalizedMessages = convertMessagesToModelMessages(messages);
          const userMessage = modelMessageToUIMessage(
            normalizedMessages[normalizedMessages.length - 1],
          );
          await getOrCreateSession(userId, session_id, userMessage.parts);
          await appendMessage(userId, session_id, "user", userMessage.parts);

          const persistAssistantMessage: ChatMiddleware = {
            name: "persist-assistant-message",
            onFinish: async (ctx) => {
              const newTurn = ctx.messages.slice(ctx.messageCount);
              const [assistantMessage] = modelMessagesToUIMessages(newTurn);
              await appendMessage(userId, session_id, "assistant", assistantMessage.parts);
            },
          };

          const stream = chat({
            adapter: adapters[model_id],
            messages,
            tools: [...allToolDefinitions],
            systemPrompts: [SYSTEM_PROMPT],
            middleware: [persistAssistantMessage],
            context: { userId } satisfies ToolContext,
          });

          return toServerSentEventsResponse(stream);
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
