import { Switch as Base } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: Base.Root.Props) {
  return (
    <Base.Root
      className={cn(
        "border-hairline relative inline-flex h-4 w-7 cursor-pointer items-center border transition-colors duration-100",
        "data-unchecked:bg-sunken data-unchecked:hover:border-hairline-strong",
        "data-checked:bg-accent data-checked:border-accent data-checked:hover:bg-accent-press",
        "focus-visible:ring-fg-muted focus-visible:ring-1 focus-visible:outline-none",
        "pointer-events-none cursor-not-allowed data-disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <Base.Thumb
        className={cn(
          "bg-fg-muted absolute top-0 left-0 h-3.5 w-3 transition-[transform,background] duration-100",
          "data-checked:bg-accent-fg data-checked:translate-x-3.5",
        )}
      />
    </Base.Root>
  );
}
