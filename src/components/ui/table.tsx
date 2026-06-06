import { cn } from "@/lib/utils";

function Root({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table className={cn("border-hairline w-full border-collapse border", className)} {...props} />
  );
}

function Header({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={className} {...props} />;
}

function Head({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "bg-raised border-hairline text-fg-faint border-b px-3.5 py-2 text-left font-mono text-[10px] font-medium tracking-wider uppercase",
        className,
      )}
      {...props}
    />
  );
}

function Body({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />;
}

function Row({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "hover:bg-raised duration-fast transition-colors [&:last-child>td]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function Cell({ className }: React.ComponentProps<"td">) {
  return <td className={cn("border-hairline text-fg border-b px-3.5 py-1.5 text-xs", className)} />;
}

export const Table = {
  Root,
  Header,
  Head,
  Body,
  Row,
  Cell,
};
