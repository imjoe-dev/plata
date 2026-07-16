import { useEffect, useRef, useState, startTransition } from "react";
import { createChatClientOptions, fetchServerSentEvents, useChat } from "@tanstack/ai-react";
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

export const plataChatOptions = createChatClientOptions({
  connection: fetchServerSentEvents("/api/chat"),
  forwardedProps: { model_id: "gpt-5.4-mini" },
});

export function usePlataChat() {
  // Mutated in place (not React state) so session_id is current the instant sendMessage reads
  // it, even mid-synchronous-call. Relies on ChatClient reading forwardedProps by reference
  // rather than cloning it — an unwritten contract that a library upgrade could silently break.
  const forwardedPropsRef = useRef<{ model_id: string; session_id?: string }>({
    model_id: "gpt-5.4-mini",
  });

  const chat = useChat({
    ...plataChatOptions,
    forwardedProps: forwardedPropsRef.current,
  });

  const messages = useBufferedMessages(chat.messages);

  function sendMessage(content: string, sessionId?: string) {
    if (sessionId) forwardedPropsRef.current.session_id = sessionId;
    return chat.sendMessage(content);
  }

  return { ...chat, messages, sendMessage };
}
