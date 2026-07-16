import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { useChatContext } from "@/contexts/chat-context";

function Root({ className, children, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      className={cn("bg-base border-hairline flex w-60 flex-col border-r py-3.5", className)}
      {...props}
    >
      {children}
    </aside>
  );
}

function Brand({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-baseline gap-2 px-4 pb-4", className)} {...props}>
      <span className="text-fg-strong font-serif text-[22px] leading-none tracking-tight italic">
        plata
      </span>
    </div>
  );
}

function NewChat({ className, ...props }: React.ComponentProps<"button">) {
  const { resetChat } = useChatContext();
  const navigate = useNavigate();

  function handleClick() {
    resetChat();
    void navigate({ to: "/" });
  }

  return (
    <button
      type="button"
      className={cn(
        "text-fg-muted hover:text-fg hover:bg-raised focus-visible:text-fg focus-visible:bg-raised duration-fast flex cursor-pointer items-center gap-2 px-4 py-1.5 text-sm transition-colors select-none focus-visible:outline-none",
        className,
      )}
      {...props}
      onClick={handleClick}
    >
      <Plus className="text-fg-faint size-4 shrink-0" />
      New Chat
    </button>
  );
}

function History({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex-1 overflow-y-auto", className)} {...props}>
      {children}
    </div>
  );
}

export const Sidebar = {
  Root,
  Brand,
  NewChat,
  History,
};
