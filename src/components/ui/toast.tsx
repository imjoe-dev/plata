import { cn } from "@/lib/utils";
import { Toast as Base } from "@base-ui/react/toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

const variants = cva("", {
  variants: {
    variant: {
      info: "bg-fg-muted",
      success: "bg-positive",
      error: "bg-negative",
      warning: "bg-caution",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export type Variant = VariantProps<typeof variants>;

export const useToast = Base.useToastManager<Variant>;

export function ToastProvider({ ...props }: Base.Provider.Props) {
  return <Base.Provider {...props} />;
}

export function Toast() {
  const { toasts } = useToast();

  return (
    <Base.Viewport className="pointer-events-none fixed top-auto right-5 bottom-5 z-60 flex flex-col gap-2 *:pointer-events-auto">
      {toasts.map((toast) => {
        const variant = toast.data?.variant ?? "info";

        return (
          <Base.Root
            key={toast.id}
            toast={toast}
            className="bg-overlay border-hairline max-w-md border px-3.5 py-2.5 shadow-sm"
          >
            <Base.Content className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-0.5 self-stretch", variants({ variant }))} />
                <Base.Title className="text-fg text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <Base.Action className="text-accent hover:text-fg-strong focus-visible:text-fg-strong cursor-pointer font-sans text-[11px] underline underline-offset-3 focus-visible:outline-none" />
                <Base.Close className="text-fg-faint hover:text-fg focus-visible:text-fg cursor-pointer focus-visible:outline-none">
                  <X className="size-2.5" />
                </Base.Close>
              </div>
            </Base.Content>
          </Base.Root>
        );
      })}
    </Base.Viewport>
  );
}
