import { getSession } from "@/lib/auth/functions";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { ChatProvider, useChatContext } from "@/contexts/chat-context";
import { authClient } from "@/lib/auth/client";
import { useChatSessions } from "@/hooks/use-chat-sessions";
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

    return { session };
  },
});

function ProtectedLayout() {
  return (
    <ChatProvider>
      <ProtectedLayoutContent />
    </ChatProvider>
  );
}

// The one place that knows where the sidebar's data/actions actually come from
// (ChatContext, Better Auth) — Sidebar itself stays pure and only consumes props.
function useProtectedLayoutActions() {
  const { resetChat } = useChatContext();
  const navigate = useNavigate();
  const { session } = Route.useRouteContext();

  function handleNewChat() {
    resetChat();
    void navigate({ to: "/" });
  }

  function handleSignOut() {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void navigate({ to: "/login" });
        },
      },
    });
  }

  return { session, handleNewChat, handleSignOut };
}

function ProtectedLayoutContent() {
  const { session, handleNewChat, handleSignOut } = useProtectedLayoutActions();
  const history = useChatSessions();
  const activeSessionId = useParams({ strict: false })?.sessionId;

  // History's states, resolved here so the sidebar primitives stay purely presentational:
  // error > loading (nothing — no skeleton, no layout shift) > empty > items
  // (+ "Show more" while another page exists).
  const showHistoryError = history.isError;
  const showHistoryEmpty = !history.isError && !history.isLoading && history.sessions.length === 0;

  return (
    <div className="flex h-screen">
      <Sidebar.Root>
        <Sidebar.Brand />
        <Sidebar.NewChat onNewChat={handleNewChat} />
        <Sidebar.History>
          {showHistoryError ? (
            <Sidebar.HistoryStatus>{"Couldn't load history"}</Sidebar.HistoryStatus>
          ) : null}
          {showHistoryEmpty ? <Sidebar.HistoryStatus>No chats yet</Sidebar.HistoryStatus> : null}
          {history.sessions.map((chatSession) => (
            <Sidebar.HistoryItem.Root
              key={chatSession.id}
              isActive={chatSession.id === activeSessionId}
              render={<Link to="/chat/$sessionId" params={{ sessionId: chatSession.id }} />}
            >
              <Sidebar.HistoryItem.Title>{chatSession.title}</Sidebar.HistoryItem.Title>
            </Sidebar.HistoryItem.Root>
          ))}
          {history.hasNextPage ? (
            <Sidebar.HistoryShowMore onShowMore={() => void history.fetchNextPage()} />
          ) : null}
        </Sidebar.History>
        <Sidebar.Account.Root user={session.user} onSignOut={handleSignOut}>
          <Sidebar.Account.Avatar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Sidebar.Account.Name />
            <Sidebar.Account.Email />
          </div>
          <Sidebar.Account.SignOut />
        </Sidebar.Account.Root>
      </Sidebar.Root>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
