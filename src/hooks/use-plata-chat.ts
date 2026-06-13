import { useEffect, useRef, useState, startTransition } from "react";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-react";

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

export function usePlataChat() {
  const chat = useChat({
    connection: fetchServerSentEvents("/api/chat"),
    forwardedProps: { model_id: "gpt-5.4-mini" },
  });

  const messages = useBufferedMessages(chat.messages);

  return { ...chat, messages };
}
