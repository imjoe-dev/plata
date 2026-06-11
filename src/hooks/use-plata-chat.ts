import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";

export function usePlataChat() {
  return useChat({
    connection: fetchServerSentEvents("/api/chat"),
    forwardedProps: { model_id: "gpt-5.4-mini" },
  });
}
