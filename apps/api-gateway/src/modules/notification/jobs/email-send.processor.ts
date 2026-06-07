/**
 * apps/api-gateway/src/modules/notification/jobs/email-send.processor.ts
 *
 * I-305 + I-806 — BullMQ processor for email:send queue. Retry 3x với
 * exponential backoff, sau đó auto-promote sang DLQ (queue_dlx) qua
 * BaseDlqProcessor.onFailed().
 */
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Job } from "bullmq";
import { ResendAdapter } from "../adapters/resend.adapter";
import { EMAIL_SEND_QUEUE } from "../email-notifier.service";
import { BaseDlqProcessor } from "../../_shared/queue/base-dlq-processor";
import { DlqService } from "../../_shared/queue/dlq.service";

interface EmailJob {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
  attachments?: Array<{ filename: string; content: string | Buffer }>;
}

@Processor(EMAIL_SEND_QUEUE)
export class EmailSendProcessor extends BaseDlqProcessor<EmailJob, { messageId: string }> {
  constructor(
    private readonly resend: ResendAdapter,
    dlq: DlqService,
    @InjectQueue(EMAIL_SEND_QUEUE) queue: Queue<EmailJob>,
  ) {
    super(dlq, queue);
  }

  async process(job: Job<EmailJob>): Promise<{ messageId: string }> {
    const data = job.data;
    const result = await this.resend.send({
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
      tags: data.tags,
      attachments: data.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content, "base64"),
      })),
    });
    this.logger.log(`sent email to=${data.to} messageId=${result.providerMessageId}`);
    return { messageId: result.providerMessageId };
  }
}
