/**
 * apps/api-gateway/src/modules/_shared/queue/queue-defaults.ts
 *
 * I-806 — Default job options cho mọi BullMQ queue.
 *
 * Convention:
 *   - 3 retries, exponential backoff (1s → 5s → 30s)
 *   - Failed job → DLQ (queue:dlx suffix) với retention 7 ngày
 *   - Complete job → auto-cleanup sau 24h
 *
 * Apply: spread `defaultJobOptions` vào BullModule.registerQueue() options.
 *        Processor nào throw sẽ tự retry; quá 3 → rơi vào DLQ.
 */
import type { ConnectionOptions, DefaultJobOptions, QueueOptions } from "bullmq";

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: false, // giữ lại → DLQ processor đọc sau
};

export const DLQ_SUFFIX = ":dlx";
export const DLQ_RETENTION_SECONDS = 7 * 24 * 3600;

export function queueOptions(
  name: string,
  connection: ConnectionOptions = { host: "localhost", port: 6379 },
): QueueOptions {
  return {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
    // BullMQ không có DLX riêng — mình implement bằng tay: khi job fail
    // hết attempts, worker move sang queue :dlx cùng tên.
  };
}

/** Tên queue DLQ cho 1 queue. */
export function dlqName(queue: string): string {
  return queue + DLQ_SUFFIX;
}
