/**
 * apps/api-gateway/src/modules/_shared/queue/base-dlq-processor.ts
 *
 * I-806 — Helper để auto-promote exhausted jobs sang DLQ.
 *
 * BullMQ không có built-in DLX. Mình hook vào WorkerHost lifecycle:
 *   - `process()` cần implement ở subclass.
 *   - `onFailed()` auto-fire khi mỗi attempt fails; chỉ promote sang DLQ
 *     khi attemptsMade === opts.attempts (đã exhausted).
 *
 * Usage trong processor:
 *
 *   @Processor(EMAIL_SEND_QUEUE)
 *   class EmailSendProcessor extends BaseDlqProcessor {
 *     constructor(
 *       private readonly resend: ResendAdapter,
 *       dlq: DlqService,
 *       @InjectQueue(EMAIL_SEND_QUEUE) queue: Queue,
 *     ) {
 *       super(dlq, queue);
 *     }
 *     async process(job: Job) { ... }
 *   }
 *
 * Subclass KHÔNG override `onFailed` — base tự xử lý.
 */
import { Logger } from "@nestjs/common";
import { WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { DlqService } from "./dlq.service";

export abstract class BaseDlqProcessor<TData = unknown, TResult = unknown> extends WorkerHost {
  protected readonly logger: Logger;

  constructor(
    protected readonly dlq: DlqService,
    protected readonly queue: Queue<TData, TResult>,
  ) {
    super();
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Final-attempt failure hook. BullMQ fire `onFailed` mỗi attempt; chỉ
   * promote sang DLQ khi `attemptsMade === opts.attempts` (đã exhausted).
   */
  async onFailed(job: Job<TData, TResult> | undefined, error: Error): Promise<void> {
    if (!job) return;
    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts ?? 3;
    if (attemptsMade < maxAttempts) {
      // Sẽ retry; không move sang DLQ.
      return;
    }
    try {
      await this.dlq.requeue(
        this.queue.name,
        this.queue as unknown as Queue,
        job.id ?? "",
        error.message,
        attemptsMade,
        job.data,
      );
    } catch (err) {
      this.logger.error(
        `dlq promote failed queue=${this.queue.name} job=${job.id} err=${(err as Error).message}`,
      );
    }
  }
}
