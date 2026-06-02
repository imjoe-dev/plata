import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tooltip, TooltipRoot, TooltipTrigger, TooltipPositioner, TooltipContent } from "./tooltip";

const meta = {
  component: Tooltip,
} satisfies Meta<typeof Tooltip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipRoot>
        <TooltipTrigger className="bg-raised text-fg px-3 py-1.5 font-mono text-xs">
          Hover me
        </TooltipTrigger>
        <TooltipPositioner>
          <TooltipContent>Tooltip content</TooltipContent>
        </TooltipPositioner>
      </TooltipRoot>
    </Tooltip>
  ),
};
