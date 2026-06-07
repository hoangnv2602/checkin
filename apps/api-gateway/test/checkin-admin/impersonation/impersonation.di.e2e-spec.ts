/**
 * apps/api-gateway/test/checkin-admin/impersonation/impersonation.di.e2e-spec.ts
 *
 * I-906 — Regression test for the ImpersonationService DI error.
 *
 * Root cause: ImpersonationService declared
 *   `constructor(private readonly store: IImpersonationStore) {}`
 * and imported the interface as a `type` binding. Interfaces are erased at
 * compile time, so reflect-metadata's `design:paramtypes[0]` resolved to
 * `Object` at runtime, and NestJS looked up a provider keyed `Object` (which
 * doesn't exist). Fix: inject the concrete `InMemoryImpersonationStore`
 * class. This test boots `ImpersonationModule` in isolation and asserts both
 * the service and the store resolve. If the interface is reintroduced as
 * the param type, this test will fail with the same UnknownDependenciesException.
 */
import { describe, it, expect } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { ImpersonationModule } from "../../../src/modules/checkin-admin/impersonation/impersonation.module";
import { ImpersonationService } from "../../../src/modules/checkin-admin/impersonation/impersonation.service";
import { InMemoryImpersonationStore } from "../../../src/modules/checkin-admin/impersonation/impersonation.store";

describe("ImpersonationModule DI graph", () => {
  it("boots ImpersonationModule and resolves ImpersonationService + InMemoryImpersonationStore", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ImpersonationModule],
    }).compile();

    const service = moduleRef.get(ImpersonationService);
    const store = moduleRef.get(InMemoryImpersonationStore);

    expect(service).toBeInstanceOf(ImpersonationService);
    expect(store).toBeInstanceOf(InMemoryImpersonationStore);
  });
});
