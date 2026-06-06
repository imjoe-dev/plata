import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import type { ModelMessage } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SUPPORTED_MODELS = ["gpt-4o", "gpt-4o-mini", "o3-mini"] as const;
type SupportedModel = (typeof SUPPORTED_MODELS)[number];

const adapters: Record<SupportedModel, ReturnType<typeof openaiText>> = {
  "gpt-4o": openaiText("gpt-4o"),
  "gpt-4o-mini": openaiText("gpt-4o-mini"),
  "o3-mini": openaiText("o3-mini"),
};

const contentPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({
    type: z.literal("image"),
    source: z.object({
      type: z.enum(["url", "data"]),
      value: z.string(),
    }),
  }),
]);

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(contentPartSchema)]),
});

const bodySchema = z.object({
  modelId: z.enum(SUPPORTED_MODELS),
  messages: z.array(messageSchema),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { modelId, messages } = bodySchema.parse(body);

        const stream = chat({
          adapter: adapters[modelId],
          messages: messages as ModelMessage[],
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
