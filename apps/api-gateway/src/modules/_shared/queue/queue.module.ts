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
import { Queue } from "bullmq";

export const MONITORED_QUEUES = "MONITORED_QUEUES";

/**
 * Singleton array shared across all consumers of the MONITORED_QUEUES token.
 * Feature modules push their Queue instances into this array during
 * `onApplicationBootstrap`. Using a module-scoped binding (instead of a
 * useFactory) ensures the array reference is stable so pushes from
 * NotificationModule (and others) are visible to StuckJobDetectorProcessor
 * and QueueReplayController.
 */
const MONITORED_QUEUES_STORE: Queue<unknown>[] = [];

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    DlqService,
    {
      provide: MONITORED_QUEUES,
      useValue: MONITORED_QUEUES_STORE,
    },
    StuckJobDetectorProcessor,
  ],
  controllers: [QueueReplayController],
  exports: [DlqService, MONITORED_QUEUES],
})
export class QueueModule implements OnApplicationBootstrap {
  constructor() {}

  onApplicationBootstrap(): void {
    // No-op: queues self-register by injecting @Inject(MONITORED_QUEUES) into
    // their module constructor and pushing Queue instances during bootstrap.
  }
}
