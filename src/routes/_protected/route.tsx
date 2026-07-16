import { getSession } from "@/lib/auth/functions";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ChatProvider } from "@/contexts/chat-context";
import { Sidebar } from "@/components/ui/sidebar";

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
      <div className="flex h-screen">
        <Sidebar.Root>
          <Sidebar.Brand />
          <Sidebar.NewChat />
          <Sidebar.History />
        </Sidebar.Root>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </ChatProvider>
  );
}
