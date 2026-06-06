/**
 * apps/api-gateway/src/modules/_shared/queue/dlq.service.ts
 *
 * I-806 — Dead-letter queue service.
 *
 * BullMQ không có built-in DLX. Mình dùng pattern:
 *   - Main queue retries 3 lần (defaultJobOptions).
 *   - Sau khi exhausted, processor gọi dlqService.requeue() để move job
 *     sang queue:dlx cùng tên + metadata lý do fail.
 *   - Admin UI đọc DLQ, xem chi tiết, replay (move lại về main queue) hoặc xóa.
 *
 * Storage format trong DLQ:
 *   { originalQueue, originalJobId, data, failedReason, attemptsMade, movedAt }
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue, type JobsOptions } from "bullmq";
import { dlqName, DLQ_RETENTION_SECONDS } from "./queue-defaults";

export interface DlqEntry {
  id: string;
  originalQueue: string;
  originalJobId: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  movedAt: string;
  payload: unknown;
}

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  /** Map tên queue gốc → BullMQ Queue instance cho DLQ. */
  private readonly _dlqs = new Map<string, Queue>();

  constructor() {}

  /** Lấy (lazy create) DLQ cho 1 source queue. */
  getDlq(sourceQueueName: string, sourceQueue: Queue): Queue {
    if (!this._dlqs.has(sourceQueueName)) {
      const dlq = new Queue(dlqName(sourceQueueName), {
        connection: sourceQueue.opts.connection,
        defaultJobOptions: {
          removeOnComplete: false,
          removeOnFail: false,
        },
      });
      this._dlqs.set(sourceQueueName, dlq);
    }
    return this._dlqs.get(sourceQueueName)!;
  }

  /** Move 1 failed job sang DLQ. */
  async requeue(
    sourceQueueName: string,
    sourceQueue: Queue,
    jobId: string,
    failedReason: string,
    attemptsMade: number,
    originalData: unknown,
  ): Promise<void> {
    const dlq = this.getDlq(sourceQueueName, sourceQueue);
    await dlq.add(
      "dlq",
      {
        originalQueue: sourceQueueName,
        originalJobId: jobId,
        failedReason,
        attemptsMade,
        movedAt: new Date().toISOString(),
        payload: originalData,
      },
      { jobId: `${sourceQueueName}:${jobId}:${Date.now()}` },
    );
    this.logger.warn(
      `dlq.move queue=${sourceQueueName} job=${jobId} reason=${failedReason} attempts=${attemptsMade}`,
    );
  }

  /** List DLQ entries cho 1 source queue. */
  async list(sourceQueueName: string, sourceQueue: Queue, skip = 0, take = 50): Promise<DlqEntry[]> {
    const dlq = this.getDlq(sourceQueueName, sourceQueue);
    const jobs = await dlq.getJobs(["waiting", "failed", "delayed"], skip, skip + take - 1);
    return jobs.map((j) => {
      const d = j.data as {
        originalQueue: string;
        originalJobId: string;
        failedReason: string;
        attemptsMade: number;
        movedAt: string;
        payload: unknown;
      };
      return {
        id: j.id ?? "",
        originalQueue: d.originalQueue,
        originalJobId: d.originalJobId,
        data: d.payload,
        failedReason: d.failedReason,
        attemptsMade: d.attemptsMade,
        movedAt: d.movedAt,
        payload: j,
      };
    });
  }

  /** Replay 1 DLQ entry: move data ngược lại source queue. */
  async replay(sourceQueueName: string, sourceQueue: Queue, dlqJobId: string): Promise<{ replayed: boolean }> {
    const dlq = this.getDlq(sourceQueueName, sourceQueue);
    const job = await dlq.getJob(dlqJobId);
    if (!job) return { replayed: false };
    const d = job.data as { payload: unknown };
    const opts: JobsOptions = { jobId: `${d.payload ? `replay-${Date.now()}` : undefined}` };
    await sourceQueue.add("replay", d.payload, opts);
    await job.remove();
    this.logger.log(`dlq.replay queue=${sourceQueueName} dlqJob=${dlqJobId}`);
    return { replayed: true };
  }

  /** Delete 1 DLQ entry. */
  async discard(sourceQueueName: string, sourceQueue: Queue, dlqJobId: string): Promise<{ discarded: boolean }> {
    const dlq = this.getDlq(sourceQueueName, sourceQueue);
    const job = await dlq.getJob(dlqJobId);
    if (!job) return { discarded: false };
    await job.remove();
    return { discarded: true };
  }
}
