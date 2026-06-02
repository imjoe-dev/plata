import { cn } from "@/lib/utils";
import { Input as Base } from "@base-ui/react/input";

export function Input({ className, ...props }: Base.Props) {
  return (
    <Base
      className={cn(
        "bg-sunken text-fg border-hairline h-7.5 w-full rounded-none border px-2.5 font-sans text-xs transition-colors duration-100 outline-none",
        "placeholder:text-fg-faint",
        "placeholder-shown:hover:not-focus:border-hairline-strong",
        "focus:bg-base focus:border-fg-muted",
        "data-invalid:border-negative",
        "data-invalid:focus:bg-base",
        "data-disabled:bg-sunken data-disabled:cursor-not-allowed data-disabled:opacity-40",
        "read-only:bg-base read-only:text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
