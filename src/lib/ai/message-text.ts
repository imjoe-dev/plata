import type { UIMessage } from "@tanstack/ai-react";

/**
 * A Chat Message's text as one string. Parts arrive split by the stream, so a single sentence
 * can span several of them — joined with no separator, since the split carries no meaning.
 * Non-text parts (tool calls) are dropped: they render as their own UI, not as prose.
 */
export function joinTextParts(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .join("");
}
