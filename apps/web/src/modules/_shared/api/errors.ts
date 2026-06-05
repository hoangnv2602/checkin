/**
 * apps/web/src/modules/_shared/api/errors.ts
 *
 * Shared error types — KHÔNG có `server-only` để cả client & server
 * đều import được.
 */

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
