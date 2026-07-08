import { describe, expect, it } from "vite-plus/test";

import { plataChatOptions } from "@/hooks/use-plata-chat";

describe("plataChatOptions", () => {
  it("registers all 17 client tools", () => {
    expect(plataChatOptions.tools).toHaveLength(17);
  });

  it("forwards the model_id prop", () => {
    expect(plataChatOptions.forwardedProps).toEqual({ model_id: "gpt-5.4-mini" });
  });

  it("targets /api/chat", () => {
    expect(plataChatOptions.connection).toBeDefined();
  });
});
