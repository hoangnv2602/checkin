/**
 * apps/api-gateway/test/queue/queue.module.di.spec.ts
 *
 * I-806 — Repro: boot QueueModule in isolation, assert DI graph resolves
 * DlqService + StuckJobDetectorProcessor + QueueReplayController.
 *
 * If this fails with the same UndefinedDependencyException as production,
 * the root cause is in queue.module.ts DI setup (likely circular import
 * between module and processor/controller re MONITORED_QUEUES token).
 */
import { describe, it, expect } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { QueueModule } from "../../src/modules/_shared/queue/queue.module";
import { DlqService } from "../../src/modules/_shared/queue/dlq.service";
import { StuckJobDetectorProcessor } from "../../src/modules/_shared/queue/stuck-job-detector.processor";
import { QueueReplayController } from "../../src/modules/_shared/queue/queue-replay.controller";

describe("QueueModule DI graph", () => {
  it("boots module and resolves DlqService + StuckJobDetectorProcessor + QueueReplayController", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [QueueModule],
    }).compile();

    const dlq = moduleRef.get(DlqService);
    const detector = moduleRef.get(StuckJobDetectorProcessor);
    const controller = moduleRef.get(QueueReplayController);

    expect(dlq).toBeInstanceOf(DlqService);
    expect(detector).toBeInstanceOf(StuckJobDetectorProcessor);
    expect(controller).toBeInstanceOf(QueueReplayController);
  });
});
