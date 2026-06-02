import type { Meta, StoryObj } from "@storybook/react-vite";

import { Progress, ProgressTrack, ProgressIndicator } from "./progress";

const meta = {
  component: Progress,
  argTypes: {
    value: {
      control: { type: "number", min: 0, max: 100 },
    },
  },
} satisfies Meta<typeof Progress>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 50,
  },
  render: (args) => (
    <Progress {...args}>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  ),
};

export const Indeterminate: Story = {
  args: {
    value: null,
  },
  render: ({ ...props }) => (
    <Progress {...props}>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  ),
};

export const Values: Story = {
  args: {
    value: null,
  },
  render: () => (
    <div className="flex w-full flex-col gap-4">
      <Progress value={10}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <Progress value={40}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <Progress value={70}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <Progress value={100}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
    </div>
  ),
};
