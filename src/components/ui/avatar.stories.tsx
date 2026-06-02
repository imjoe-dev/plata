import type { Meta, StoryObj } from "@storybook/react-vite";

import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

const meta = {
  component: Avatar,
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
    },
    shape: {
      control: "select",
      options: ["square", "round"],
    },
  },
} satisfies Meta<typeof Avatar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: "md",
    shape: "round",
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const WithImage: Story = {
  args: {
    size: "md",
    shape: "round",
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://i.pravatar.cc/100" alt="User" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="xs" shape="round">
        <AvatarFallback>XS</AvatarFallback>
      </Avatar>
      <Avatar size="sm" shape="round">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar size="md" shape="round">
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg" shape="round">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const Square: Story = {
  args: {
    size: "md",
    shape: "square",
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};
