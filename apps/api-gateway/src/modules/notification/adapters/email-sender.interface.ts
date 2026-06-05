/**
 * apps/api-gateway/src/modules/notification/adapters/email-sender.interface.ts
 *
 * I-305 — EmailSender abstraction. Adapters:
 *   - ResendAdapter   (production — D4 preferred transactional)
 *   - ConsoleAdapter  (dev — log to stdout)
 *   - SmtpAdapter     (fallback ở phase sau nếu Resend down)
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  tags?: string[];
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export interface EmailSendResult {
  providerMessageId: string;
}

export interface EmailSenderInterface {
  readonly name: "resend" | "console" | "smtp";
  send(msg: EmailMessage): Promise<EmailSendResult>;
}
