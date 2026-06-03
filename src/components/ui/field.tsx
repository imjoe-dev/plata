import { cn } from "@/lib/utils";
import { Field as Base } from "@base-ui/react/field";

export function Field({ className, ...props }: Base.Root.Props) {
  return <Base.Root className={cn("", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: Base.Label.Props) {
  return (
    <Base.Label
      className={cn(
        "text-fg-faint mb-1.5 block font-mono text-[10px] tracking-wider uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function FieldDescription({ className, ...props }: Base.Description.Props) {
  return (
    <Base.Description
      className={cn("text-fg-faint mt-1 font-mono text-[10px]", className)}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: Base.Error.Props) {
  return (
    <Base.Error className={cn("text-negative mt-1 font-mono text-[10px]", className)} {...props} />
  );
}
