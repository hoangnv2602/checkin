/**
 * apps/api-gateway/src/modules/_shared/queue/queue.module.ts
 *
 * I-806 — Shared queue module: DLQ service, stuck detector, replay controller.
 *
 * Exports DlqService + injectable token `MONITORED_QUEUES`. Feature modules
 * register queues via `QueueModule.register(queue)` từ constructor để
 * StuckJobDetector sweep tất cả active queue mỗi phút.
 */
import { Global, Module, type OnApplicationBootstrap } from "@nestjs/common";
import { DlqService } from "./dlq.service";
import { StuckJobDetectorProcessor } from "./stuck-job-detector.processor";
import { QueueReplayController } from "./queue-replay.controller";
import { ScheduleModule } from "@nestjs/schedule";
import type { Queue } from "bullmq";

export const MONITORED_QUEUES = "MONITORED_QUEUES";

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    DlqService,
    {
      provide: MONITORED_QUEUES,
      useFactory: (): Queue<unknown>[] => [],
    },
    StuckJobDetectorProcessor,
    QueueReplayController,
  ],
  controllers: [QueueReplayController],
  exports: [DlqService, MONITORED_QUEUES],
})
export class QueueModule implements OnApplicationBootstrap {
  constructor() {}

  onApplicationBootstrap(): void {
    // No-op: queues self-register qua QueueModule.register() trong feature
    // module constructor (typed for clarity).
  }
}
