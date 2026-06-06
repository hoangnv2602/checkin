/**
 * apps/api-gateway/src/modules/_shared/queue/queue.module.ts
 *
 * I-806 — Shared queue module: DLQ service, stuck detector, replay controller.
 */
import { Global, Module, type OnApplicationBootstrap } from "@nestjs/common";
import { DlqService } from "./dlq.service";
import { StuckJobDetectorProcessor } from "./stuck-job-detector.processor";
import { QueueReplayController } from "./queue-replay.controller";
import type { Queue } from "bullmq";

@Global()
@Module({
  providers: [DlqService, QueueReplayController],
  exports: [DlqService],
})
export class QueueModule implements OnApplicationBootstrap {
  constructor(
    private readonly dlq: DlqService,
    private readonly replayController: QueueReplayController,
  ) {}

  /**
   * Bootstrap: discover registered queues, instantiate stuck-job detector.
   * Phase 9+ sẽ wire tự động từ @nestjs/bullmq ModuleRef.
   */
  onApplicationBootstrap(): void {
    // Queues hiện tại được khai báo qua BullModule.registerQueue trong
    // từng feature module. Phase 9 sẽ quét qua ModuleRef.find() để auto-register.
  }

  /** Helper để module khác register queue cần monitor. */
  static monitorQueues(queues: Queue<unknown>[]): void {
    // Stored globally cho StuckJobDetectorProcessor (singleton).
    if (!(globalThis as { __monitoredQueues?: Queue<unknown>[] }).__monitoredQueues) {
      (globalThis as { __monitoredQueues?: Queue<unknown>[] }).__monitoredQueues = [];
    }
    (globalThis as { __monitoredQueues: Queue<unknown>[] }).__monitoredQueues.push(...queues);
  }
}
