import { useEffect, useRef } from "react";
import type { UIMessage } from "@tanstack/ai-react";

import type { usePlataChat } from "@/hooks/use-plata-chat";
import { isDeleteTool } from "@/lib/ai/tool-call-display-state";

interface UseSameTurnApprovalBridgeOptions {
  messages: UIMessage[];
  /** Chat Messages where Session Approval was granted mid-reply. */
  approvedMessageIds: ReadonlySet<string>;
  addToolApprovalResponse: ReturnType<typeof usePlataChat>["addToolApprovalResponse"];
}

/**
 * The same-turn bridge from docs/adr/0006. Session Approval is decided per `/api/chat` request,
 * so a grant made partway through a reply can't reach the tools already built for that in-flight
 * request — the rest of the reply would prompt again. This answers them client-side instead, and
 * is not the authority: the persisted flag is, for every later turn.
 *
 * Delete Mutating Tools are skipped unconditionally, mid-bridge included.
 */
export function useSameTurnApprovalBridge({
  messages,
  approvedMessageIds,
  addToolApprovalResponse,
}: UseSameTurnApprovalBridgeOptions) {
  // A ref, not state: it must be current the instant it's read, including mid-render.
  const respondedApprovalIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (approvedMessageIds.size === 0) return;

    for (const message of messages) {
      if (!approvedMessageIds.has(message.id)) continue;

      for (const part of message.parts) {
        if (part.type !== "tool-call" || part.state !== "approval-requested" || !part.approval) {
          continue;
        }
        if (isDeleteTool(part.name) || respondedApprovalIdsRef.current.has(part.approval.id)) {
          continue;
        }
        respondedApprovalIdsRef.current.add(part.approval.id);
        void addToolApprovalResponse({ id: part.approval.id, approved: true });
      }
    }
  }, [messages, approvedMessageIds, addToolApprovalResponse]);

  return {
    /** Claim an approval id the user resolved directly, so the bridge leaves it alone. */
    markResponded: (approvalId: string) => {
      respondedApprovalIdsRef.current.add(approvalId);
    },
  };
}
