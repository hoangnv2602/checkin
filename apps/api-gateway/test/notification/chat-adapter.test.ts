/**
 * apps/api-gateway/test/notification/chat-adapter.test.ts
 *
 * I-802 — Unit test cho SlackAdapter + DiscordAdapter với mock fetch.
 * Verify: success path, retry on 429, exhausted retries throw.
 */
import { SlackAdapter } from "../../src/modules/notification/adapters/slack.adapter";
import { DiscordAdapter } from "../../src/modules/notification/adapters/discord.adapter";

const TENANT = "t_test";
const baseMsg = {
  channelId: "C012345",
  text: "hello",
  tenantId: TENANT,
};

describe("SlackAdapter", () => {
  const webhook = "https://hooks.slack.com/services/X/Y/Z";
  const fetchWebhook = async () => webhook;

  it("POSTs to webhook, returns providerMessageId", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: "1234567890.123" }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const adapter = new SlackAdapter(fetchWebhook);
    const result = await adapter.send(baseMsg);

    expect(result.provider).toBe("slack");
    expect(result.providerMessageId).toBe("1234567890.123");
    expect(mockFetch).toHaveBeenCalledWith(
      webhook,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retries on 429 then succeeds", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "rate limited" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, ts: "9999" }) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const adapter = new SlackAdapter(fetchWebhook);
    const result = await adapter.send(baseMsg);
    expect(result.providerMessageId).toBe("9999");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausted retries", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const adapter = new SlackAdapter(fetchWebhook);
    await expect(adapter.send(baseMsg)).rejects.toThrow(/slack send failed/);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws if webhook not configured", async () => {
    const adapter = new SlackAdapter(async () => null);
    await expect(adapter.send(baseMsg)).rejects.toThrow(/webhook not configured/);
  });
});

describe("DiscordAdapter", () => {
  const webhook = "https://discord.com/api/webhooks/123/abc";

  it("POSTs to webhook với content + thread", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "9876543210" }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const adapter = new DiscordAdapter(async () => webhook);
    const result = await adapter.send({ ...baseMsg, threadId: "parent_msg_id" });

    expect(result.provider).toBe("discord");
    expect(result.providerMessageId).toBe("9876543210");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.content).toBe("hello");
    expect(body.message_reference.message_id).toBe("parent_msg_id");
  });

  it("handles 204 No Content thành công", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const adapter = new DiscordAdapter(async () => webhook);
    const result = await adapter.send(baseMsg);
    expect(result.providerMessageId).toMatch(/^discord-\d+$/);
  });
});
