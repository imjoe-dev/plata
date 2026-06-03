import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "bg-sunken text-fg border-hairline flex field-sizing-content min-h-18 w-full rounded-none border px-2.5 py-2 font-sans text-xs transition-colors duration-100 outline-none",
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
