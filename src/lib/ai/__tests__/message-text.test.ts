import { describe, expect, it } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";

import { joinTextParts } from "@/lib/ai/message-text";

function message(parts: UIMessage["parts"]): UIMessage {
  return { id: "m1", role: "user", parts } as UIMessage;
}

describe("joinTextParts", () => {
  it("joins consecutive text parts with no separator, since the stream's split carries no meaning", () => {
    const result = joinTextParts(
      message([
        { type: "text", content: "Hello " },
        { type: "text", content: "world" },
      ] as UIMessage["parts"]),
    );

    expect(result).toBe("Hello world");
  });

  it("returns the content unchanged for a single part", () => {
    const result = joinTextParts(
      message([{ type: "text", content: "Categorize my Uber rides" }] as UIMessage["parts"]),
    );

    expect(result).toBe("Categorize my Uber rides");
  });

  it("drops tool-call parts, which render as their own UI rather than prose", () => {
    const result = joinTextParts(
      message([
        { type: "text", content: "Logging that" },
        { type: "tool-call", id: "tc", name: "create_transaction", arguments: "{}" },
        { type: "text", content: " now" },
      ] as UIMessage["parts"]),
    );

    expect(result).toBe("Logging that now");
  });

  it("returns an empty string for a message with no text parts", () => {
    const result = joinTextParts(
      message([
        { type: "tool-call", id: "tc", name: "create_transaction", arguments: "{}" },
      ] as UIMessage["parts"]),
    );

    expect(result).toBe("");
  });
});
