import { Progress as Base } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

export function Progress({ ...props }: Base.Root.Props) {
  return <Base.Root {...props} />;
}

export function ProgressTrack({ className, ...props }: Base.Track.Props) {
  return (
    <Base.Track className={cn("bg-hairline relative h-0.5 w-full overflow-hidden")} {...props} />
  );
}

export function ProgressIndicator({ className, ...props }: Base.Indicator.Props) {
  return (
    <Base.Indicator
      className={cn(
        "bg-accent absolute inset-y-0 left-0 transition-[width] duration-300 ease-out data-indeterminate:w-1/3 data-indeterminate:animate-[slide_1.2s_ease-in-out_infinite]",
      )}
      {...props}
    />
  );
}
