/**
 * apps/api-gateway/src/modules/notification/adapters/slack.adapter.spec.ts
 *
 * I-802 — Vitest tests cho Slack adapter retry/backoff behavior.
 * Mocks global fetch; no rate limiter (test path).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SlackAdapter } from "./slack.adapter";

describe("SlackAdapter", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends webhook with correct payload on first try", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: "1700000000.000100" }),
    });
    const adapter = new SlackAdapter(async () => "https://hooks.slack.com/x");
    const result = await adapter.send({
      tenantId: "t1",
      channelId: "C0123",
      text: "Hello",
    });
    expect(result.provider).toBe("slack");
    expect(result.providerMessageId).toBe("1700000000.000100");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.channel).toBe("C0123");
    expect(body.text).toBe("Hello");
  });

  it("retries on 429 then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "rate limited" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, ts: "1700000001.000200" }),
      });
    const adapter = new SlackAdapter(async () => "https://hooks.slack.com/x");
    const result = await adapter.send({ tenantId: "t1", channelId: "C1", text: "x" });
    expect(result.providerMessageId).toBe("1700000001.000200");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "unavailable" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, ts: "1700000002.000300" }),
      });
    const adapter = new SlackAdapter(async () => "https://hooks.slack.com/x");
    const result = await adapter.send({ tenantId: "t1", channelId: "C1", text: "x" });
    expect(result.providerMessageId).toBe("1700000002.000300");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries and throws after 3 attempts", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    const adapter = new SlackAdapter(async () => "https://hooks.slack.com/x");
    await expect(
      adapter.send({ tenantId: "t1", channelId: "C1", text: "x" }),
    ).rejects.toThrow(/exhausted 3 attempts/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 4xx (except 429)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" });
    const adapter = new SlackAdapter(async () => "https://hooks.slack.com/x");
    await expect(
      adapter.send({ tenantId: "t1", channelId: "C1", text: "x" }),
    ).rejects.toThrow(/send failed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws if webhook not configured", async () => {
    const adapter = new SlackAdapter(async () => null);
    await expect(
      adapter.send({ tenantId: "t1", channelId: "C1", text: "x" }),
    ).rejects.toThrow(/not configured/);
  });

  it("throws on Slack API error response (ok:false body)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: "channel_not_found" }),
    });
    const adapter = new SlackAdapter(async () => "https://hooks.slack.com/x");
    await expect(
      adapter.send({ tenantId: "t1", channelId: "C1", text: "x" }),
    ).rejects.toThrow(/channel_not_found/);
  });

  it("includes thread_ts when threadId provided", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ts: "1700000003.000400" }),
    });
    const adapter = new SlackAdapter(async () => "https://hooks.slack.com/x");
    await adapter.send({
      tenantId: "t1",
      channelId: "C1",
      text: "reply",
      threadId: "1700000000.000100",
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.thread_ts).toBe("1700000000.000100");
  });
});
