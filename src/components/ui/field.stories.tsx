import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field, FieldLabel, FieldDescription, FieldError } from "./field";
import { Input } from "./input";

const meta = {
  component: Field,
} satisfies Meta<typeof Field>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Field>
      <FieldLabel>Email</FieldLabel>
      <Input placeholder="example@gmai.com" />
      <FieldDescription>Enter your email</FieldDescription>
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field invalid>
      <FieldLabel>Email</FieldLabel>
      <Input type="email" required placeholder="example@gmai.com" />
      <FieldError>Enter a valid email</FieldError>
      <FieldDescription>Enter your email</FieldDescription>
    </Field>
  ),
};
