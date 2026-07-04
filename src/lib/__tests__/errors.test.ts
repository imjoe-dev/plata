import { describe, expect, it } from "vite-plus/test";

import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

describe("errors", () => {
  it("ValidationError maps to 400 with fieldErrors", () => {
    const err = new ValidationError({ amount: ["Required"] });
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.toJSON()).toEqual({
      name: "ValidationError",
      status: 400,
      fieldErrors: { amount: ["Required"] },
    });
  });

  it("NotFoundError maps to 404 with resource and id", () => {
    const err = new NotFoundError("category", "cat_123");
    expect(err.status).toBe(404);
    expect(err.toJSON()).toEqual({
      name: "NotFoundError",
      status: 404,
      resource: "category",
      id: "cat_123",
    });
  });

  it("ConflictError maps to 409 with constraint and field", () => {
    const err = new ConflictError("categories_name_user_id_unique", "name");
    expect(err.status).toBe(409);
    expect(err.toJSON()).toEqual({
      name: "ConflictError",
      status: 409,
      constraint: "categories_name_user_id_unique",
      field: "name",
    });
  });

  it("InternalError maps to 500 with message and optional cause", () => {
    const cause = new Error("boom");
    const err = new InternalError("insert returned no rows", cause);
    expect(err.status).toBe(500);
    expect(err.toJSON()).toEqual({
      name: "InternalError",
      status: 500,
      message: "insert returned no rows",
    });
    expect(err.cause).toBe(cause);
  });
});
