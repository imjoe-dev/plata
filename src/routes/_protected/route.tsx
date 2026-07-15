import { getSession } from "@/lib/auth/functions";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ChatProvider } from "@/contexts/chat-context";

export const Route = createFileRoute("/_protected")({
  component: ProtectedLayout,
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
  },
});

function ProtectedLayout() {
  return (
    <ChatProvider>
      <Outlet />
    </ChatProvider>
  );
}
