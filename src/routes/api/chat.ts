import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from "@tanstack/ai";
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

const modelIdSchema = z.object({
  modelId: z.enum(SUPPORTED_MODELS),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { modelId } = modelIdSchema.parse(body);
        const { messages } = await chatParamsFromRequestBody(body);

        const stream = chat({
          adapter: adapters[modelId],
          messages,
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
