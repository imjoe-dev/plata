import type { Meta, StoryObj } from "@storybook/react-vite";

import { Divider } from "./divider";

const meta = {
  component: Divider,
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal"],
    },
    dashed: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Divider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    orientation: "vertical",
    dashed: false,
  },
  decorators: [
    (Story) => (
      <div className="flex h-48">
        <Story />
      </div>
    ),
  ],
};
