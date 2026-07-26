import { createContext, useContext, useState } from "react";
import type { ToolCallPart } from "@tanstack/ai-client";

import { useChatContext } from "@/contexts/chat-context";
import { useAutoApproval } from "@/hooks/use-auto-approval";
import { isDeleteTool } from "@/lib/ai/tool-call-display-state";
import { apiPost } from "@/lib/ai/fetch";
import { toastManager } from "@/components/ui/toast-manager";

interface ToolCallApprovalActions {
  approve: () => void;
  deny: () => void;
  /** Absent — not disabled — on delete Mutating Tools (docs/adr/0006) and on any part that
   *  carries no approval, which is what keeps the third action out of the row entirely. */
  approveForSession?: () => void;
}

interface ToolApprovalContextValue {
  state: {
    /** Chat Messages where Session Approval was granted during the current reply. */
    approvedMessageIds: ReadonlySet<string>;
  };
  actions: {
    forPart: (part: ToolCallPart, messageId: string) => ToolCallApprovalActions;
  };
}

const ToolApprovalContext = createContext<ToolApprovalContextValue | null>(null);

export function useToolApproval(): ToolApprovalContextValue {
  const ctx = useContext(ToolApprovalContext);
  if (!ctx) throw new Error("useToolApproval must be used within a ToolApprovalProvider");
  return ctx;
}

/**
 * Owns Session Approval (docs/adr/0006) on the client: which Chat Messages have been granted it
 * mid-reply, the same-turn bridge that acts on that, and the request that persists the flag.
 *
 * Deliberately separate from ChatProvider, which is transport — streaming, hydration, History
 * freshness. This is policy, and it reads what it needs from that context rather than owning it.
 */
export function ToolApprovalProvider({ children }: { children: React.ReactNode }) {
  const { messages, addToolApprovalResponse, sessionId } = useChatContext();
  const [approvedMessageIds, setApprovedMessageIds] = useState<ReadonlySet<string>>(new Set());
  const { markResponded } = useAutoApproval({
    messages,
    approvedMessageIds,
    addToolApprovalResponse,
  });

  function grantSessionApproval(approvalId: string, messageId: string) {
    // Claimed before responding so the bridge's re-scan skips it — otherwise this call would be
    // answered twice, once here and once by the effect that runs on the state change below.
    markResponded(approvalId);
    void addToolApprovalResponse({ id: approvalId, approved: true });
    setApprovedMessageIds((prev) => new Set(prev).add(messageId));

    apiPost(`/api/chat/sessions/${sessionId}/approve-mutations`).catch(() => {
      toastManager.add({
        title: "Couldn't save your approval for this session — you may be asked again.",
        data: { variant: "error" },
      });
    });
  }

  function forPart(part: ToolCallPart, messageId: string): ToolCallApprovalActions {
    const approvalId = part.approval?.id;
    // No approval means nothing to answer — the actions exist but do nothing, rather than
    // asserting an id that isn't there.
    if (!approvalId) return { approve: () => {}, deny: () => {} };

    return {
      approve: () => void addToolApprovalResponse({ id: approvalId, approved: true }),
      deny: () => void addToolApprovalResponse({ id: approvalId, approved: false }),
      approveForSession: isDeleteTool(part.name)
        ? undefined
        : () => grantSessionApproval(approvalId, messageId),
    };
  }

  return (
    <ToolApprovalContext.Provider value={{ state: { approvedMessageIds }, actions: { forPart } }}>
      {children}
    </ToolApprovalContext.Provider>
  );
}
