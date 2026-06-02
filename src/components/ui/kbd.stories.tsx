import type { Meta, StoryObj } from "@storybook/react-vite";

import { Kbd } from "./kbd";

const meta = {
  component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "⌘K",
  },
};
