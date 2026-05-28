import type { Meta, StoryObj } from "@storybook/react-vite";

import { Switch } from "./switch";

const meta = {
  component: Switch,
  argTypes: {
    checked: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
    required: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Switch>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
    disabled: false,
    required: false,
  },
};
