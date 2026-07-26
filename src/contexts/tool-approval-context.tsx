import { createContext, use, useState } from "react";
import type { ToolCallPart } from "@tanstack/ai-client";

import { useChatContext } from "@/contexts/chat-context";
import { useSameTurnApprovalBridge } from "@/hooks/use-same-turn-approval-bridge";
import { isDeleteTool } from "@/lib/ai/tool-call-display-state";
import { apiPost } from "@/lib/ai/fetch";
import { toastManager } from "@/components/ui/toast-manager";

interface ToolCallApprovalActions {
  approve: () => void;
  deny: () => void;
  /** Absent — not disabled — on delete Mutating Tools (docs/adr/0006) and on parts carrying
   *  no approval, which keeps the third action out of the row entirely. */
  approveForSession?: () => void;
}

interface ToolApprovalContextValue {
  state: {
    approvedMessageIds: ReadonlySet<string>;
  };
  actions: {
    forPart: (part: ToolCallPart, messageId: string) => ToolCallApprovalActions;
  };
}

const ToolApprovalContext = createContext<ToolApprovalContextValue | null>(null);

export function useToolApproval(): ToolApprovalContextValue {
  const ctx = use(ToolApprovalContext);
  if (!ctx) throw new Error("useToolApproval must be used within a ToolApprovalProvider");
  return ctx;
}

/**
 * Owns Session Approval (docs/adr/0006) on the client. Deliberately separate from ChatProvider,
 * which is transport — streaming, hydration, History freshness. This is policy.
 */
export function ToolApprovalProvider({ children }: { children: React.ReactNode }) {
  const { messages, addToolApprovalResponse, sessionId } = useChatContext();
  // Not cleared on reset or session change: the grant must outlive the `/` → `/chat/:id` swap,
  // which happens mid-reply for a brand-new chat. Chat Message ids are unique across Chat
  // Sessions, so a stale entry can't match a later reply.
  const [approvedMessageIds, setApprovedMessageIds] = useState<ReadonlySet<string>>(new Set());
  const { markResponded } = useSameTurnApprovalBridge({
    messages,
    approvedMessageIds,
    addToolApprovalResponse,
  });

  function grantSessionApproval(approvalId: string, messageId: string) {
    // Claimed first, or the bridge's re-scan below answers this same call a second time.
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
    // Nothing to answer — no-ops rather than asserting an id that isn't there.
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
