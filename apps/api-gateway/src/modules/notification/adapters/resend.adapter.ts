/**
 * apps/api-gateway/src/modules/notification/adapters/resend.adapter.ts
 *
 * I-305 — Resend.com adapter. POST /v1/emails với API key từ env.
 *
 * Webhook (bounce/complaint) cũng do Resend fire về /v1/notification/webhooks/resend
 * — Phase 6 sẽ wire suppression list ở đây.
 */
import { Injectable, Logger } from "@nestjs/common";
import type { EmailMessage, EmailSenderInterface, EmailSendResult } from "./email-sender.interface";

@Injectable()
export class ResendAdapter implements EmailSenderInterface {
  readonly name = "resend" as const;
  private readonly logger = new Logger(ResendAdapter.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly from = process.env.RESEND_FROM ?? "noreply@saas-checkin.com";

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    if (!this.apiKey) {
      // dev fallback: log + return fake id
      this.logger.log(`[DEV-RESEND] to=${msg.to} subject="${msg.subject}"`);
      return { providerMessageId: `dev-${Date.now()}` };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: msg.from ?? this.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.replyTo,
        tags: msg.tags?.map((name) => ({ name })),
        attachments: msg.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend send failed: ${res.status} ${err}`);
    }
    const data = (await res.json()) as { id: string };
    return { providerMessageId: data.id };
  }
}
