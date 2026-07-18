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
import { useChatSessions, type ChatSessionItem } from "@/hooks/use-chat-sessions";
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

type HistoryContentProps = {
  sessions: ChatSessionItem[];
  isLoading: boolean;
  isError: boolean;
  activeSessionId: string | undefined;
  hasNextPage: boolean;
  onShowMore: () => void;
};

// History's states, resolved here so the sidebar primitives stay purely presentational:
// error > loading (nothing — no skeleton, no layout shift) > empty > items
// (+ "Show more" while another page exists).
function HistoryContent({
  sessions,
  isLoading,
  isError,
  activeSessionId,
  hasNextPage,
  onShowMore,
}: HistoryContentProps) {
  if (isError) return <Sidebar.HistoryStatus>{"Couldn't load history"}</Sidebar.HistoryStatus>;
  if (isLoading) return null;
  if (sessions.length === 0) return <Sidebar.HistoryStatus>No chats yet</Sidebar.HistoryStatus>;

  return (
    <>
      {sessions.map((session) => (
        <Sidebar.HistoryItem.Root
          key={session.id}
          isActive={session.id === activeSessionId}
          render={<Link to="/chat/$sessionId" params={{ sessionId: session.id }} />}
        >
          <Sidebar.HistoryItem.Title>{session.title}</Sidebar.HistoryItem.Title>
        </Sidebar.HistoryItem.Root>
      ))}
      {hasNextPage ? <Sidebar.HistoryShowMore onShowMore={onShowMore} /> : null}
    </>
  );
}

function ProtectedLayoutContent() {
  const { session, handleNewChat, handleSignOut } = useProtectedLayoutActions();
  const { sessions, isLoading, isError, hasNextPage, fetchNextPage } = useChatSessions();
  const activeSessionId = useParams({ strict: false })?.sessionId;

  function handleShowMore() {
    void fetchNextPage();
  }

  return (
    <div className="flex h-screen">
      <Sidebar.Root>
        <Sidebar.Brand />
        <Sidebar.NewChat onNewChat={handleNewChat} />
        <Sidebar.History>
          <HistoryContent
            sessions={sessions}
            isLoading={isLoading}
            isError={isError}
            activeSessionId={activeSessionId}
            hasNextPage={hasNextPage}
            onShowMore={handleShowMore}
          />
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
