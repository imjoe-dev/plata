import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const variants = cva("", {
  variants: {
    orientation: {
      horizontal: "h-px w-full",
      vertical: "w-px self-stretch",
    },
    dashed: {
      true: "border-hairline border-t border-dashed",
      false: "bg-hairline",
    },
  },
  defaultVariants: {
    orientation: "vertical",
    dashed: false,
  },
});

export function Divider({
  className,
  orientation,
  dashed,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof variants>) {
  return <div className={cn(variants({ className, orientation, dashed }))} {...props} />;
}
