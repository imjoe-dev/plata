import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "border-hairline text-fg-faint inline-flex items-center border px-1.5 py-px font-mono text-[10px] leading-none",
        className,
      )}
      {...props}
    />
  );
}
