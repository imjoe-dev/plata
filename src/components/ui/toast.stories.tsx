import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef } from "react";

import { Button } from "./button";
import { Toast, ToastProvider, type Variant } from "./toast";
import { toastManager } from "./toast-manager";

function ToastDemo({ variant }: Variant) {
  const count = useRef(0);

  function addToast() {
    count.current += 1;
    toastManager.add({
      title: `Toast #${count.current}`,
      data: { variant },
      actionProps: {
        children: "undo",
        onClick: () => {
          alert(`action triggerd for toast ${count.current}`);
        },
      },
    });
  }

  return (
    <div>
      <Button variant="primary" onClick={addToast}>
        Add Toast
      </Button>
    </div>
  );
}

const meta = {
  component: ToastDemo,
  argTypes: {
    variant: {
      control: "select",
      options: ["info", "success", "error", "warning"],
    },
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <Toast />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: "info",
  },
  render: ({ variant }) => <ToastDemo variant={variant} />,
};
