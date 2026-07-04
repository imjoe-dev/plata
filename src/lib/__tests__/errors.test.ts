import { describe, expect, it } from "vite-plus/test";

import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

describe("AppError subclasses", () => {
  it("UnauthorizedError has status 401 and a name/status JSON", () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.name).toBe("UnauthorizedError");
    expect(err.toJSON()).toEqual({ name: "UnauthorizedError", status: 401 });
  });

  it("ValidationError includes fieldErrors", () => {
    const err = new ValidationError({ name: ["required"] });
    expect(err.status).toBe(400);
    expect(err.toJSON()).toMatchObject({ fieldErrors: { name: ["required"] } });
  });

  it("NotFoundError includes resource and id", () => {
    const err = new NotFoundError("category", "c1");
    expect(err.status).toBe(404);
    expect(err.toJSON()).toMatchObject({ resource: "category", id: "c1" });
  });

  it("ConflictError includes constraint and field", () => {
    const err = new ConflictError("categories_name_user_id_unique", "name");
    expect(err.status).toBe(409);
    expect(err.toJSON()).toMatchObject({
      constraint: "categories_name_user_id_unique",
      field: "name",
    });
  });

  it("InternalError has status 500", () => {
    expect(new InternalError("boom").status).toBe(500);
  });

  it("all subclasses extend AppError", () => {
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
    expect(new ValidationError({})).toBeInstanceOf(AppError);
    expect(new NotFoundError("x", "1")).toBeInstanceOf(AppError);
    expect(new ConflictError("c", "f")).toBeInstanceOf(AppError);
    expect(new InternalError("x")).toBeInstanceOf(AppError);
  });
});
