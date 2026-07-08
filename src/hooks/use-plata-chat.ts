import { useEffect, useRef, useState, startTransition } from "react";
import { createChatClientOptions, fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-react";

import { allClientTools } from "@/lib/ai/tools/client";

function useBufferedMessages(raw: UIMessage[]) {
  const [buffered, setBuffered] = useState(raw);
  const latestRef = useRef(raw);
  const pendingRef = useRef(false);

  useEffect(() => {
    latestRef.current = raw;
    if (!pendingRef.current) {
      pendingRef.current = true;
      requestAnimationFrame(() => {
        startTransition(() => {
          setBuffered(latestRef.current);
        });
        pendingRef.current = false;
      });
    }
  }, [raw]);

  return buffered;
}

export const plataChatOptions = createChatClientOptions({
  connection: fetchServerSentEvents("/api/chat"),
  forwardedProps: { model_id: "gpt-5.4-mini" },
  tools: allClientTools,
});

export function usePlataChat() {
  const chat = useChat(plataChatOptions);

  const messages = useBufferedMessages(chat.messages);

  return { ...chat, messages };
}
