/**
 * apps/api-gateway/src/modules/_shared/queue/stuck-job-detector.processor.ts
 *
 * I-806 — Stuck job detector: scan định kỳ tất cả active queue, nếu job
 * ở trạng thái `active` quá 5 phút → mark failed → DLQ.
 *
 * Chạy mỗi phút qua cron scheduler. Mỗi queue có thể override threshold.
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Queue } from "bullmq";
import { DlqService } from "./dlq.service";

export const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

@Injectable()
export class StuckJobDetectorProcessor {
  private readonly logger = new Logger(StuckJobDetectorProcessor.name);

  /** Inject danh sách queue cần monitor. */
  constructor(
    private readonly dlq: DlqService,
    private readonly monitoredQueues: Queue<unknown>[],
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    const now = Date.now();
    for (const queue of this.monitoredQueues) {
      const active = await queue.getActive(0, 100);
      for (const job of active) {
        const processedOn = job.processedOn ?? 0;
        if (now - processedOn > STUCK_THRESHOLD_MS) {
          this.logger.warn(`stuck queue=${queue.name} job=${job.id} processedOn=${processedOn}`);
          try {
            await job.moveToFailed(new Error("stuck-job-timeout"), job.token ?? "stuck-detector");
            await this.dlq.requeue(queue.name, queue, job.id ?? "", "stuck-job-timeout", job.attemptsMade, job.data);
          } catch (err) {
            this.logger.error(`stuck handler failed queue=${queue.name} job=${job.id} err=${(err as Error).message}`);
          }
        }
      }
    }
  }
}
