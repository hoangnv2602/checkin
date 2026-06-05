/**
 * apps/api-gateway/src/modules/auth/dto/auth.dto.spec.ts
 *
 * Unit tests cho class-validator DTOs (I-105).
 */
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { LoginDto, RefreshDto, RegisterDto } from "./auth.dto";

async function validateDto<T extends object>(dtoClass: new () => T, obj: unknown) {
  const inst = plainToInstance(dtoClass, obj);
  return validate(inst as object);
}

describe("LoginDto", () => {
  it("accepts valid email + password", async () => {
    const errs = await validateDto(LoginDto, { email: "alice@acme.test", password: "PlainP@ss123" });
    expect(errs).toHaveLength(0);
  });

  it("rejects invalid email", async () => {
    const errs = await validateDto(LoginDto, { email: "not-an-email", password: "PlainP@ss123" });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects password < 8 chars", async () => {
    const errs = await validateDto(LoginDto, { email: "a@b.com", password: "short" });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects password > 128 chars", async () => {
    const errs = await validateDto(LoginDto, { email: "a@b.com", password: "x".repeat(129) });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe("RefreshDto", () => {
  it("accepts non-empty string", async () => {
    const errs = await validateDto(RefreshDto, { refreshToken: "abc" });
    expect(errs).toHaveLength(0);
  });

  it("rejects empty string", async () => {
    const errs = await validateDto(RefreshDto, { refreshToken: "" });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe("RegisterDto", () => {
  it("accepts all valid fields", async () => {
    const errs = await validateDto(RegisterDto, {
      email: "bob@acme.test",
      fullName: "Bob Nguyễn",
      password: "BobP@ss123",
      organizationName: "Bob Events",
      organizationSlug: "bob-events",
    });
    expect(errs).toHaveLength(0);
  });

  it("rejects short slug", async () => {
    const errs = await validateDto(RegisterDto, {
      email: "b@x.com",
      fullName: "B",
      password: "BobP@ss123",
      organizationName: "Bob Events",
      organizationSlug: "a",
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects missing fields", async () => {
    const errs = await validateDto(RegisterDto, {});
    expect(errs.length).toBeGreaterThan(0);
  });
});
