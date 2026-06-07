/**
 * apps/api-gateway/test/recurring/recurring.di.e2e-spec.ts
 *
 * I-904 — Regression test for the EventSeriesService DI error.
 *
 * Root cause: EventSeriesService declared
 *   `constructor(private readonly store: IEventSeriesStore) {}`
 * where `IEventSeriesStore` is an interface (erased at compile time). Nest's
 * reflect-metadata surfaced `Object` to the injector and failed with
 * UnknownDependenciesException. Fix: inject the concrete
 * `InMemoryEventSeriesStore` class. This test boots `RecurringModule` in
 * isolation; if the interface is reintroduced as the param type, this test
 * will fail.
 */
import { describe, it, expect } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { RecurringModule } from "../../src/modules/recurring/recurring.module";
import { EventSeriesService, InMemoryEventSeriesStore } from "../../src/modules/recurring/event-series.service";

describe("RecurringModule DI graph", () => {
  it("boots RecurringModule and resolves EventSeriesService + InMemoryEventSeriesStore", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [RecurringModule],
    }).compile();

    const service = moduleRef.get(EventSeriesService);
    const store = moduleRef.get(InMemoryEventSeriesStore);

    expect(service).toBeInstanceOf(EventSeriesService);
    expect(store).toBeInstanceOf(InMemoryEventSeriesStore);
  });
});
