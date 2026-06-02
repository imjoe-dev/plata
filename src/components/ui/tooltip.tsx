import { cn } from "@/lib/utils";
import { Tooltip as Base } from "@base-ui/react/tooltip";

export function Tooltip({ ...props }: Base.Provider.Props) {
  return <Base.Provider {...props} />;
}

export function TooltipRoot({ ...props }: Base.Root.Props) {
  return <Base.Root {...props} />;
}

export function TooltipTrigger({ ...props }: Base.Trigger.Props) {
  return <Base.Trigger {...props} />;
}

export function TooltipPositioner({ sideOffset = 4, ...props }: Base.Positioner.Props) {
  return (
    <Base.Portal>
      <Base.Positioner sideOffset={sideOffset} {...props} />
    </Base.Portal>
  );
}

export function TooltipContent({ className, ...props }: Base.Popup.Props) {
  return (
    <Base.Popup
      className={cn(
        "bg-overlay border-hairline text-fg-strong max-w-xs border px-2 py-1.5 font-mono text-[11px] shadow-sm",
        "data-starting-style:animate-[animate-in_100ms_ease-out]",
        "data-ending-style:animate-[animate-out_100ms_ease-out]",
        className,
      )}
      {...props}
    />
  );
}
