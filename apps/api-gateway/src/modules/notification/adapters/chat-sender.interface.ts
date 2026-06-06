/**
 * apps/api-gateway/src/modules/notification/adapters/chat-sender.interface.ts
 *
 * I-802 — ChatSender abstraction (Slack + Discord).
 * Mirror của EmailSenderInterface (I-305).
 */
export type ChatProvider = "slack" | "discord";

export interface ChatMessage {
  /** Channel/user/thread ID — vd "C012345" (Slack) hoặc "1234567890" (Discord channel). */
  channelId: string;
  /** Markdown text. Slack dùng mrkdwn, Discord dùng markdown — adapter convert. */
  text: string;
  /** Optional thread id — reply vào thread. */
  threadId?: string;
  /** Optional block kit / embed attachments (Slack blocks hoặc Discord embeds). */
  blocks?: unknown[];
  /** Tenant id — dùng để route + audit log. */
  tenantId: string;
  /** Tags cho metric / log filtering. */
  tags?: string[];
}

export interface ChatSendResult {
  providerMessageId: string;
  provider: ChatProvider;
}

export interface ChatSenderInterface {
  readonly name: ChatProvider;
  send(msg: ChatMessage): Promise<ChatSendResult>;
}
