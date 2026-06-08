/**
 * apps/api-gateway/src/modules/notification/email-notifier.service.ts
 *
 * I-305 — top-level EmailNotifier. Public API:
 *  - sendTicketConfirmation({ organizationId, registration })
 *  - sendPaymentReceipt({ order, total })
 *  - sendEventReminder({ registration, event })
 *  - sendOtp({ email, otp }) — used by /ticket/[regId] OTP gate
 *
 * Internally render Twig template + delegate to EmailSender (Resend prod,
 * console dev). BullMQ queue `email:send` for retry.
 */
import { Inject, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { ResendAdapter } from "./adapters/resend.adapter";
import { renderTemplate } from "./templates/twig-renderer";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

// BullMQ rejects queue names containing `:` (Redis key separator). Must
// match `^[A-Za-z0-9_-]+$`. See test/queue/queue-names.spec.ts.
export const EMAIL_SEND_QUEUE = "email_send";

@Injectable()
export class EmailNotifierService implements OnModuleInit {
  private readonly logger = new Logger(EmailNotifierService.name);

  constructor(
    private readonly resend: ResendAdapter,
    @Optional() @InjectQueue(EMAIL_SEND_QUEUE) private readonly queue?: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log("EmailNotifierService ready");
  }

  async sendTicketConfirmation(input: {
    organizationId: string;
    organizationName: string;
    attendeeEmail: string;
    attendeeName: string;
    eventTitle: string;
    eventStartAt: string;
    venue: string;
    ticketUrl: string;
    qrAttachment?: Buffer;
  }): Promise<{ queued: boolean }> {
    const tpl = await renderTemplate("ticket-confirmation", {
      attendeeName: input.attendeeName,
      eventTitle: input.eventTitle,
      eventStartAt: input.eventStartAt,
      venue: input.venue,
      ticketUrl: input.ticketUrl,
      orgName: input.organizationName,
    });
    return this.enqueue({
      to: input.attendeeEmail,
      ...tpl,
      tags: ["ticket-confirmation", `org:${input.organizationId}`],
      attachments: input.qrAttachment
        ? [{ filename: "ticket.png", content: input.qrAttachment }]
        : undefined,
    });
  }

  async sendPaymentReceipt(input: {
    organizationId: string;
    organizationName: string;
    buyerEmail: string;
    buyerName: string;
    orderId: string;
    eventTitle: string;
    quantity: number;
    totalFormatted: string;
    provider: string;
  }): Promise<{ queued: boolean }> {
    const tpl = await renderTemplate("payment-receipt", {
      buyerName: input.buyerName,
      eventTitle: input.eventTitle,
      orderId: input.orderId,
      quantity: input.quantity,
      totalFormatted: input.totalFormatted,
      provider: input.provider,
      orgName: input.organizationName,
    });
    return this.enqueue({
      to: input.buyerEmail,
      ...tpl,
      tags: ["payment-receipt", `org:${input.organizationId}`],
    });
  }

  async sendEventReminder(input: {
    organizationId: string;
    organizationName: string;
    attendeeEmail: string;
    attendeeName: string;
    eventTitle: string;
    eventStartAt: string;
    venue: string;
    relativeTime: string; // "in 1 hour" | "tomorrow"
    ticketUrl: string;
  }): Promise<{ queued: boolean }> {
    const tpl = await renderTemplate("event-reminder", {
      attendeeName: input.attendeeName,
      eventTitle: input.eventTitle,
      eventStartAt: input.eventStartAt,
      venue: input.venue,
      relativeTime: input.relativeTime,
      ticketUrl: input.ticketUrl,
      orgName: input.organizationName,
    });
    return this.enqueue({
      to: input.attendeeEmail,
      ...tpl,
      tags: ["event-reminder", `org:${input.organizationId}`],
    });
  }

  async sendOtp(input: { email: string; otp: string; ticketUrl: string }): Promise<{ queued: boolean }> {
    const tpl = await renderTemplate("ticket-otp", {
      otp: input.otp,
      ticketUrl: input.ticketUrl,
    });
    return this.enqueue({
      to: input.email,
      ...tpl,
      tags: ["otp"],
    });
  }

  private async enqueue(msg: {
    to: string;
    subject: string;
    html: string;
    text: string;
    tags?: string[];
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<{ queued: boolean }> {
    if (this.queue) {
      await this.queue.add("send", msg, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      return { queued: true };
    }
    // dev fallback — send inline
    await this.resend.send(msg);
    return { queued: false };
  }
}
