import { useCallback, useEffect, useRef, useState, startTransition } from "react";
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
  // A stable, mutated-in-place object (never replaced) rather than React state: sendMessage
  // needs session_id to be current the instant it's called, even when that call happens in the
  // same synchronous handler as minting a brand-new session id — a state update wouldn't be
  // visible until the next render, but a direct mutation is visible immediately.
  //
  // This relies on ChatClient storing forwardedProps by reference (not cloning it) and reading
  // it fresh immediately before each request — verified against the installed
  // @tanstack/ai-client source, not just documented behavior. It's an implementation detail,
  // not a public contract: a future library version that defensively clones forwardedProps
  // would silently break this with no type error. Revisit if useChat's sendMessage ever exposes
  // a per-call forwardedProps override directly (it exists on the underlying ChatClient today,
  // but isn't threaded through the React hook's sendMessage in the installed version).
  const forwardedPropsRef = useRef<{ model_id: string; session_id?: string }>({
    model_id: "gpt-5.4-mini",
  });

  const chat = useChat({
    ...plataChatOptions,
    forwardedProps: forwardedPropsRef.current,
  });

  const messages = useBufferedMessages(chat.messages);

  const sendMessage = useCallback(
    (content: string, sessionId?: string) => {
      if (sessionId) forwardedPropsRef.current.session_id = sessionId;
      return chat.sendMessage(content);
    },
    // Depend on chat.sendMessage itself, not the whole chat object — usePlataChat's own return
    // below is a fresh object literal every render regardless, so depending on the whole object
    // would defeat the memoization; the underlying useChat's individual action functions are the
    // part that's actually kept referentially stable.
    [chat.sendMessage],
  );

  return { ...chat, messages, sendMessage };
}
