import type { Meta, StoryObj } from "@storybook/react-vite";

import { RadioGroup, Radio } from "./radio-group";

const meta = {
  component: RadioGroup,
  argTypes: {
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof RadioGroup>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    disabled: false,
  },
  render: (args) => (
    <RadioGroup className="flex gap-2" {...args}>
      <Radio value="option-a" />
      <Radio value="option-b" />
      <Radio value="option-c" />
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <RadioGroup className="flex gap-2" {...args}>
      <Radio value="option-a" />
      <Radio value="option-b" />
      <Radio value="option-c" />
    </RadioGroup>
  ),
};
