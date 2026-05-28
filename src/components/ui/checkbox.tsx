import { Checkbox as Base } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: Base.Root.Props) {
  return (
    <Base.Root
      className={cn(
        "group border-hairline bg-sunken text-fg flex size-3.5 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-none border text-xs transition-colors duration-100 select-none",
        "data-disabled:cursor-not-allowed data-disabled:opacity-40",
        "data-unchecked:hover:border-hairline-strong",
        "focus-visible:ring-fg-muted focus-visible:ring-1 focus-visible:outline-none",
        "data-checked:bg-accent data-checked:border-accent data-checked:hover:bg-accent-press",
        "data-indeterminate:bg-accent data-indeterminate:border-accent",
        "data-invalid:border-negative data-invalid:bg-negative",
        className,
      )}
      {...props}
    >
      <Base.Indicator className="text-accent-fg flex h-full w-full items-center justify-center">
        <Check className="hidden size-2.5 group-data-checked:block" strokeWidth={1.5} />
        <Minus className="hidden w-2 group-data-indeterminate:block" />
      </Base.Indicator>
    </Base.Root>
  );
}
