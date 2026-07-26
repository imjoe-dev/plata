import type { UIMessage } from "@tanstack/ai-react";

/**
 * A Chat Message's text as one string. The stream splits a sentence across parts arbitrarily, so
 * they join with no separator. Tool calls are dropped — they render as their own UI, not prose.
 */
export function joinTextParts(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .join("");
}
