import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from "@tanstack/ai";
import { createOpenaiChat, openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { allToolDefinitions } from "@/lib/ai/tools/index";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";

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
        const { messages, forwardedProps } = await chatParamsFromRequestBody(body);
        const { model_id } = modelIdSchema.parse(forwardedProps ?? {});

        const stream = chat({
          adapter: adapters[model_id],
          messages,
          tools: [...allToolDefinitions],
          systemPrompts: [SYSTEM_PROMPT],
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
