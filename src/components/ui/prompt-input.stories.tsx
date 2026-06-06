import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromptInput } from "./prompt-input";

const meta = {
  component: PromptInput.Root,
} satisfies Meta<typeof PromptInput.Root>;
export default meta;

export const Default: StoryObj<typeof PromptInput.Root> = {
  render() {
    return (
      <PromptInput.Root>
        <PromptInput.Toolbar />
        <PromptInput.Editor />
      </PromptInput.Root>
    );
  },
};

export const WithPlaceholder: StoryObj<typeof PromptInput.Root> = {
  render() {
    return (
      <PromptInput.Root placeholder="What transactions do you want to create?">
        <PromptInput.Toolbar />
        <PromptInput.Editor />
      </PromptInput.Root>
    );
  },
};

export const WithDefaultValue: StoryObj<typeof PromptInput.Root> = {
  render() {
    return (
      <PromptInput.Root defaultValue="<p>Create a <strong>recurring transaction</strong> for my rent</p><ul><li><p>$1,500 monthly</p></li><li><p>Category: housing</p></li></ul>">
        <PromptInput.Toolbar />
        <PromptInput.Editor />
      </PromptInput.Root>
    );
  },
};

export const Disabled: StoryObj<typeof PromptInput.Root> = {
  render() {
    return (
      <PromptInput.Root disabled defaultValue="<p>You cannot edit this</p>">
        <PromptInput.Toolbar />
        <PromptInput.Editor />
      </PromptInput.Root>
    );
  },
};

export const Controlled: StoryObj<typeof PromptInput.Root> = {
  render() {
    const [value, setValue] = useState("<p>Edit me...</p>");
    return (
      <div className="space-y-4">
        <PromptInput.Root value={value} onChange={setValue}>
          <PromptInput.Toolbar />
          <PromptInput.Editor />
        </PromptInput.Root>
        <pre className="bg-sunken text-fg-muted overflow-x-auto p-3 font-mono text-xs">{value}</pre>
      </div>
    );
  },
};
