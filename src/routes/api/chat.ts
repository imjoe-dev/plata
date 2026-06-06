import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from "@tanstack/ai";
import { createOpenaiChat, openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";

const SUPPORTED_MODELS = ["gpt-5.4-mini"] as const;
type SupportedModel = (typeof SUPPORTED_MODELS)[number];

const adapters: Record<SupportedModel, ReturnType<typeof openaiText>> = {
  "gpt-5.4-mini": createOpenaiChat("gpt-5.4-mini", env.OPENAI_API_KEY),
};

const modelIdSchema = z.object({
  model_id: z.enum(SUPPORTED_MODELS),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { model_id } = modelIdSchema.parse(body);
        const { messages } = await chatParamsFromRequestBody(body);

        const stream = chat({
          adapter: adapters[model_id],
          messages,
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
