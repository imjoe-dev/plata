import { cn } from "@/lib/utils";
import { Button as Base } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

const variants = cva(
  [
    "inline-flex items-center justify-center rounded-none border font-medium",
    "focus-visible:ring-fg-muted transition-colors duration-100 ease-out select-none",
    "focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-accent text-accent-fg border-accent",
          "hover:bg-[oklch(0.96_0.20_118)]",
          "active:bg-accent-press active:shadow-[inset_0_1px_0_rgba(0,0,0,0.2)]",
        ],
        secondary: [
          [
            "bg-raised text-fg border-hairline",
            "hover:bg-overlay hover:border-hairline-strong",
            "active:bg-sunken active:border-hairline-strong active:shadow-[inset_0_1px_0_rgba(0,0,0,0.4)]",
          ],
        ],
        ghost: [
          "text-fg-muted border-transparent bg-transparent",
          "hover:text-fg hover:bg-raised hover:border-hairline",
          "active:bg-sunken active:text-fg active:border-hairline",
          "focus-visible:text-fg focus-visible:border-hairline",
        ],
        destructive: [
          "text-negative border-hairline bg-transparent",
          "hover:bg-negative/10 hover:border-negative",
          "active:bg-negative active:border-negative active:text-[oklch(0.16_0.04_25)]",
          "focus-visible:ring-negative",
        ],
      },
      size: {
        sm: "h-7 gap-1.5 px-2.5 text-xs",
        md: "h-7.5 gap-2 px-3.5 text-xs",
        lg: "h-9 gap-2 px-4 text-sm",
        icon: "size-7.5 gap-0 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: Base.Props & VariantProps<typeof variants>) {
  return <Base className={cn(variants({ className, variant, size }))} {...props} />;
}
