export type ErrorJSON = Record<string, unknown>;

export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = this.constructor.name;
    this.status = status;
  }

  toJSON(): ErrorJSON {
    return { name: this.name, status: this.status };
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super(400, "Validation failed");
    this.fieldErrors = fieldErrors;
  }

  toJSON(): ErrorJSON {
    return { ...super.toJSON(), fieldErrors: this.fieldErrors };
  }
}

export class NotFoundError extends AppError {
  readonly resource: string;
  readonly id: string;

  constructor(resource: string, id: string, itemIndex?: number) {
    const prefix = itemIndex !== undefined ? `item ${itemIndex}: ` : "";
    super(404, `${prefix}${resource} not found: ${id}`);
    this.resource = resource;
    this.id = id;
  }

  toJSON(): ErrorJSON {
    return { ...super.toJSON(), resource: this.resource, id: this.id };
  }
}

export class ConflictError extends AppError {
  readonly constraint: string;
  readonly field: string;

  constructor(constraint: string, field: string) {
    super(409, `Conflict on ${field}`);
    this.constraint = constraint;
    this.field = field;
  }

  toJSON(): ErrorJSON {
    return { ...super.toJSON(), constraint: this.constraint, field: this.field };
  }
}

export class InternalError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(500, message, { cause });
  }

  toJSON(): ErrorJSON {
    return { ...super.toJSON(), message: this.message };
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(401, "Unauthorized");
  }

  toJSON(): ErrorJSON {
    return super.toJSON();
  }
}

export class RateLimitedError extends AppError {
  constructor() {
    super(429, "Rate limit exceeded");
  }

  toJSON(): ErrorJSON {
    return super.toJSON();
  }
}
