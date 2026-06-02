import { Avatar as Base } from "@base-ui/react/avatar";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const variants = cva(
  "bg-accent text-accent-fg flex items-center justify-center overflow-clip font-semibold",
  {
    variants: {
      size: {
        xs: "size-5 text-[10px]",
        sm: "size-5.5 text-[11px]",
        md: "size-7 text-xs",
        lg: "size-10 text-xs",
      },
      shape: {
        square: "rounded-none",
        round: "rounded-full",
      },
    },
  },
);

export function Avatar({
  className,
  size,
  shape,
  ...props
}: Base.Root.Props & VariantProps<typeof variants>) {
  return <Base.Root className={cn(variants({ className, size, shape }))} {...props} />;
}

export function AvatarImage({ className, ...props }: Base.Image.Props) {
  return <Base.Image className={cn("bg-cover bg-center", className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: Base.Fallback.Props) {
  return <Base.Fallback className={cn("flex items-center justify-center", className)} {...props} />;
}
