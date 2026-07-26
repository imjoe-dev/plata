// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";
import type { ToolCallPart } from "@tanstack/ai-client";

vi.mock("@/contexts/chat-context", () => ({
  useChatContext: vi.fn(),
}));
vi.mock("@/lib/ai/fetch", () => ({
  apiPost: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/components/ui/toast-manager", () => ({
  toastManager: { add: vi.fn() },
}));

import { useChatContext } from "@/contexts/chat-context";
import { apiPost } from "@/lib/ai/fetch";
import { toastManager } from "@/components/ui/toast-manager";
import { ToolApprovalProvider, useToolApproval } from "@/contexts/tool-approval-context";

function toolCallPart(overrides: Partial<ToolCallPart> = {}): ToolCallPart {
  return {
    type: "tool-call",
    id: "tc",
    name: "create_transaction",
    arguments: "{}",
    state: "approval-requested",
    approval: { id: "appr", needsApproval: true },
    ...overrides,
  } as ToolCallPart;
}

function assistantMessage(parts: ToolCallPart[], id = "m1"): UIMessage {
  return { id, role: "assistant", parts } as UIMessage;
}

/** Surfaces one part's approval actions as buttons — the provider is headless, so this
 *  stands in for whatever UI would bind them. No design-system components involved. */
function Probe({ part, messageId }: { part: ToolCallPart; messageId: string }) {
  const { actions } = useToolApproval();
  const { approve, deny, approveForSession } = actions.forPart(part, messageId);
  return (
    <div>
      <button onClick={approve}>approve</button>
      <button onClick={deny}>deny</button>
      {approveForSession && <button onClick={approveForSession}>approve for session</button>}
    </div>
  );
}

function renderProvider(message: UIMessage, { sessionId = "sess_1" }: { sessionId?: string } = {}) {
  const addToolApprovalResponse = vi.fn();
  vi.mocked(useChatContext).mockReturnValue({
    messages: [message],
    addToolApprovalResponse,
    sessionId,
  } as unknown as ReturnType<typeof useChatContext>);

  const toolCallParts = message.parts.filter(
    (part): part is ToolCallPart => part.type === "tool-call",
  );

  render(
    <ToolApprovalProvider>
      {toolCallParts.map((part) => (
        <Probe key={part.approval!.id} part={part} messageId={message.id} />
      ))}
    </ToolApprovalProvider>,
  );

  return { addToolApprovalResponse };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiPost).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("ToolApprovalProvider per-call approval", () => {
  it("responds with approved: true when the user approves one call", () => {
    const { addToolApprovalResponse } = renderProvider(
      assistantMessage([toolCallPart({ approval: { id: "appr_1", needsApproval: true } })]),
    );

    fireEvent.click(screen.getByText("approve"));

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_1", approved: true });
  });

  it("responds with approved: false when the user denies one call", () => {
    const { addToolApprovalResponse } = renderProvider(
      assistantMessage([toolCallPart({ approval: { id: "appr_1", needsApproval: true } })]),
    );

    fireEvent.click(screen.getByText("deny"));

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_1", approved: false });
  });
});

describe("ToolApprovalProvider Session Approval (docs/adr/0006)", () => {
  it("offers Session Approval on a non-delete Mutating Tool", () => {
    renderProvider(assistantMessage([toolCallPart()]));

    expect(screen.queryByText("approve for session")).not.toBeNull();
  });

  it("never offers Session Approval on a delete Mutating Tool", () => {
    renderProvider(assistantMessage([toolCallPart({ name: "delete_transaction" })]));

    expect(screen.queryByText("approve for session")).toBeNull();
  });

  it("approves the clicked call and persists the flag against the Chat Session in view", () => {
    const { addToolApprovalResponse } = renderProvider(
      assistantMessage([toolCallPart({ approval: { id: "appr_1", needsApproval: true } })]),
      { sessionId: "sess_42" },
    );

    fireEvent.click(screen.getByText("approve for session"));

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_1", approved: true });
    expect(apiPost).toHaveBeenCalledWith("/api/chat/sessions/sess_42/approve-mutations");
  });

  it("responds to the clicked call exactly once, even after the same-turn bridge re-scans it", () => {
    const { addToolApprovalResponse } = renderProvider(assistantMessage([toolCallPart()]));

    fireEvent.click(screen.getByText("approve for session"));

    expect(addToolApprovalResponse).toHaveBeenCalledTimes(1);
  });

  it("auto-resolves a further non-delete Mutating Tool in the same reply once granted", () => {
    const { addToolApprovalResponse } = renderProvider(
      assistantMessage([
        toolCallPart({ id: "tc_a", approval: { id: "appr_a", needsApproval: true } }),
        toolCallPart({ id: "tc_b", approval: { id: "appr_b", needsApproval: true } }),
      ]),
    );

    fireEvent.click(screen.getAllByText("approve for session")[0]);

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_a", approved: true });
    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_b", approved: true });
  });

  it("still prompts individually for a delete Mutating Tool in the same reply after granting", () => {
    const { addToolApprovalResponse } = renderProvider(
      assistantMessage([
        toolCallPart({ id: "tc_a", approval: { id: "appr_a", needsApproval: true } }),
        toolCallPart({
          id: "tc_del",
          name: "delete_transaction",
          approval: { id: "appr_del", needsApproval: true },
        }),
      ]),
    );

    fireEvent.click(screen.getByText("approve for session"));

    expect(addToolApprovalResponse).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "appr_del" }),
    );
  });

  it("warns the user when the flag could not be persisted, since they may be asked again", async () => {
    vi.mocked(apiPost).mockRejectedValue(new Error("offline"));
    renderProvider(assistantMessage([toolCallPart()]));

    fireEvent.click(screen.getByText("approve for session"));
    await vi.waitFor(() => expect(toastManager.add).toHaveBeenCalled());

    expect(toastManager.add).toHaveBeenCalledWith({
      title: "Couldn't save your approval for this session — you may be asked again.",
      data: { variant: "error" },
    });
  });
});
