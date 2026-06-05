/**
 * apps/web/src/modules/_shared/api/errors.test.ts
 */
import { describe, it, expect } from "vitest";
import { AuthError } from "./errors";

describe("AuthError", () => {
  it("sets status + message + name", () => {
    const err = new AuthError(401, "Unauthorized");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.status).toBe(401);
    expect(err.message).toBe("Unauthorized");
    expect(err.name).toBe("AuthError");
  });

  it("captures non-401 status codes", () => {
    expect(new AuthError(500, "boom").status).toBe(500);
    expect(new AuthError(403, "forbidden").status).toBe(403);
  });
});
