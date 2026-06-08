/**
 * apps/api-gateway/test/sub-org/sub-org.di.e2e-spec.ts
 *
 * I-905 — Regression test for the SubOrgService DI error.
 *
 * Root cause: SubOrgService declared
 *   `constructor(private readonly store: ISubOrgStore) {}`
 * and imported the interface as a `type` binding. Interfaces are erased at
 * compile time, so reflect-metadata's `design:paramtypes[0]` resolved to
 * `Object` at runtime. Fix: inject the concrete `InMemorySubOrgStore` class.
 * This test boots `SubOrgModule` in isolation; if the interface is
 * reintroduced as the param type, this test will fail with
 * UnknownDependenciesException.
 */
import { describe, it, expect } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { SubOrgModule } from "../../src/modules/sub-org/sub-org.module";
import { SubOrgService } from "../../src/modules/sub-org/sub-org.service";
import { InMemorySubOrgStore } from "../../src/modules/sub-org/sub-org.store";

describe("SubOrgModule DI graph", () => {
  it("boots SubOrgModule and resolves SubOrgService + InMemorySubOrgStore", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SubOrgModule],
    }).compile();

    const service = moduleRef.get(SubOrgService);
    const store = moduleRef.get(InMemorySubOrgStore);

    expect(service).toBeInstanceOf(SubOrgService);
    expect(store).toBeInstanceOf(InMemorySubOrgStore);
  });
});
