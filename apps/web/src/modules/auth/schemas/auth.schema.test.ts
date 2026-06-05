/**
 * apps/web/src/modules/auth/schemas/auth.schema.test.ts
 *
 * Unit tests cho zod schemas mirror BFF DTOs.
 */
import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "./auth.schema";

describe("loginSchema", () => {
  it("accepts valid email + password", () => {
    const r = loginSchema.safeParse({
      email: "alice@acme.test",
      password: "PlainP@ss123",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "PlainP@ss123" });
    expect(r.success).toBe(false);
  });

  it("rejects short password", () => {
    const r = loginSchema.safeParse({ email: "alice@acme.test", password: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects password > 128 chars", () => {
    const r = loginSchema.safeParse({
      email: "alice@acme.test",
      password: "a".repeat(129),
    });
    expect(r.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    email: "bob@acme.test",
    fullName: "Bob Nguyễn",
    password: "BobP@ss123",
    organizationName: "Bob Events",
    organizationSlug: "bob-events",
  };

  it("accepts valid payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty fullName", () => {
    const r = registerSchema.safeParse({ ...valid, fullName: "" });
    expect(r.success).toBe(false);
  });

  it("rejects short organizationName", () => {
    const r = registerSchema.safeParse({ ...valid, organizationName: "A" });
    expect(r.success).toBe(false);
  });

  it("accepts kebab-case slug", () => {
    const r = registerSchema.safeParse({ ...valid, organizationSlug: "abc-123" });
    expect(r.success).toBe(true);
  });

  it("rejects uppercase slug", () => {
    const r = registerSchema.safeParse({ ...valid, organizationSlug: "ABC" });
    expect(r.success).toBe(false);
  });

  it("rejects slug with leading dash", () => {
    const r = registerSchema.safeParse({ ...valid, organizationSlug: "-abc" });
    expect(r.success).toBe(false);
  });

  it("rejects slug with trailing dash", () => {
    const r = registerSchema.safeParse({ ...valid, organizationSlug: "abc-" });
    expect(r.success).toBe(false);
  });

  it("rejects slug with underscore", () => {
    const r = registerSchema.safeParse({ ...valid, organizationSlug: "abc_def" });
    expect(r.success).toBe(false);
  });

  it("rejects slug > 40 chars", () => {
    const r = registerSchema.safeParse({
      ...valid,
      organizationSlug: "a".repeat(41),
    });
    expect(r.success).toBe(false);
  });
});
