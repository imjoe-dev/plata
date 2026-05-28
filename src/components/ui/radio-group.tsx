import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { cn } from "@/lib/utils";

export function RadioGroup({ ...props }: BaseRadioGroup.Props) {
  return <BaseRadioGroup {...props} />;
}

export function Radio({ className, ...props }: BaseRadio.Root.Props) {
  return (
    <BaseRadio.Root
      className={cn(
        "text-fg border-hairline bg-sunken flex size-3.5 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border text-xs transition-colors duration-100 select-none",
        "hover:border-hairline-strong",
        "focus-visible:ring-fg-muted focus-visible:ring-1 focus-visible:outline-none",
        "data-checked:border-accent",
        "data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <BaseRadio.Indicator className="inline-flex size-full items-center justify-center">
        <div className="size-full bg-[radial-gradient(circle,oklch(0.90_0.20_118)_0_4px,transparent_5px)]" />
      </BaseRadio.Indicator>
    </BaseRadio.Root>
  );
}
