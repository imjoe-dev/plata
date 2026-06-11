import { ScrollArea as Base } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";

function Root({ className, ...props }: Base.Root.Props) {
  return <Base.Root className={cn(className)} {...props} />;
}

function Viewport({ className, ...props }: Base.Viewport.Props) {
  return <Base.Viewport className={cn("h-full w-full", className)} {...props} />;
}

function Content({ className, ...props }: Base.Content.Props) {
  return <Base.Content className={cn(className)} {...props} />;
}

function Scrollbar({ className, ...props }: Base.Scrollbar.Props) {
  return (
    <Base.Scrollbar
      className={cn("flex touch-none flex-col p-0.5 select-none", className)}
      {...props}
    />
  );
}

function Thumb({ className, ...props }: Base.Thumb.Props) {
  return (
    <Base.Thumb
      className={cn(
        "relative flex-1 rounded-none",
        "bg-fg-muted opacity-0 transition-opacity duration-300",
        "group-data-[hovering]:opacity-100 group-data-[scrolling]:opacity-100",
        "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-1",
        className,
      )}
      {...props}
    />
  );
}

function Corner({ className, ...props }: Base.Corner.Props) {
  return <Base.Corner className={cn("hidden", className)} {...props} />;
}

export const ScrollArea = {
  Root,
  Viewport,
  Content,
  Scrollbar,
  Thumb,
  Corner,
};
