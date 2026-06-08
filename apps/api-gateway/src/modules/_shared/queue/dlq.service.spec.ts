/**
 * apps/api-gateway/src/modules/_shared/queue/dlq.service.spec.ts
 *
 * I-806 — DlqService tests using vi.mock('bullmq') to stub Queue class.
 * Cover: requeue (move to _dlx), list, replay, discard.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

/** In-memory Queue stub (replaces bullmq Queue class). */
class FakeQueue {
  readonly name: string;
  readonly opts: { connection: unknown };
  readonly jobs = new Map<string, { data: unknown }>();

  constructor(name: string, opts?: { connection?: unknown }) {
    this.name = name;
    this.opts = { connection: opts?.connection ?? { host: "memory", port: 0 } };
  }

  async add(_jobName: string, data: unknown, opts: { jobId?: string }): Promise<unknown> {
    const id = opts.jobId ?? `${this.name}-${this.jobs.size + 1}`;
    this.jobs.set(id, { data });
    return { id };
  }

  async getJobs(_states: string[], _skip: number, _take: number): Promise<Array<{ id: string; data: unknown }>> {
    return Array.from(this.jobs.entries()).map(([id, j]) => ({ id, data: j.data }));
  }

  async getJob(id: string): Promise<{ id: string; data: unknown } | undefined> {
    const j = this.jobs.get(id);
    return j ? { id, data: j.data } : undefined;
  }

  async remove(id: string): Promise<void> {
    this.jobs.delete(id);
  }
}

const dlqs = new Map<string, FakeQueue>();

vi.mock("bullmq", () => {
  return {
    Queue: class {
      readonly name: string;
      readonly opts: { connection: unknown };
      constructor(name: string, opts?: { connection?: unknown }) {
        this.name = name;
        this.opts = { connection: opts?.connection ?? { host: "memory", port: 0 } };
        if (!dlqs.has(name)) {
          dlqs.set(name, new FakeQueue(name, opts));
        }
      }
      async add(...args: unknown[]): Promise<unknown> {
        return dlqs.get(this.name)!.add(...(args as [string, unknown, { jobId?: string }]));
      }
      async getJobs(...args: unknown[]): Promise<unknown> {
        return dlqs.get(this.name)!.getJobs(...(args as [string[], number, number]));
      }
      async getJob(id: string): Promise<unknown> {
        const q = dlqs.get(this.name)!;
        const j = await q.getJob(id);
        if (!j) return undefined;
        // Wrap as Job-like with .remove() so dlqService.discard/replay works.
        return {
          id: j.id,
          data: j.data,
          remove: async () => q.remove(id),
        };
      }
    },
  };
});

import { DlqService, type DlqEntry } from "./dlq.service";
import { dlqName } from "./queue-defaults";

describe("DlqService", () => {
  let service: DlqService;
  let sourceQueue: FakeQueue;

  beforeEach(() => {
    dlqs.clear();
    service = new DlqService();
    sourceQueue = new FakeQueue("email_send"); // sanitized: matches DLQ
  });

  it("requeue() creates DLQ queue and moves job", async () => {
    await service.requeue(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      "job-1",
      "boom",
      3,
      { to: "a@b.c" },
    );
    const dlq = dlqs.get("email_send_dlx");
    expect(dlq).toBeDefined();
    expect(dlq!.jobs.size).toBe(1);
    const entry = Array.from(dlq!.jobs.values())[0].data as Record<string, unknown>;
    expect(entry.originalQueue).toBe("email_send");
    expect(entry.originalJobId).toBe("job-1");
    expect(entry.failedReason).toBe("boom");
    expect(entry.attemptsMade).toBe(3);
    expect(entry.payload).toEqual({ to: "a@b.c" });
    expect(entry.movedAt).toBeDefined();
  });

  it("dlqName() sanitizes : to _ and appends _dlx", () => {
    // Use arbitrary input — BullMQ rejects raw `:` in queue names so the
    // production constant EMAIL_SEND_QUEUE is already sanitized. We're
    // testing the sanitizer's behavior on legacy / hostile input.
    expect(dlqName("email:send")).toBe("email_send_dlx");
    expect(dlqName("chat_send")).toBe("chat_send_dlx");
  });

  it("list() returns DlqEntry projections", async () => {
    await service.requeue(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      "job-1",
      "err",
      3,
      { x: 1 },
    );
    await service.requeue(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      "job-2",
      "err2",
      3,
      { x: 2 },
    );
    const entries: DlqEntry[] = await service.list(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
    );
    expect(entries.length).toBe(2);
    expect(entries[0].originalJobId).toMatch(/job-[12]/);
    expect(entries[0].failedReason).toBeDefined();
  });

  it("replay() moves data back to source queue, removes from DLQ", async () => {
    await service.requeue(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      "job-1",
      "err",
      3,
      { x: 1 },
    );
    const dlq = dlqs.get("email_send_dlx")!;
    const dlqJobId = Array.from(dlq.jobs.keys())[0];
    const result = await service.replay(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      dlqJobId,
    );
    expect(result.replayed).toBe(true);
    expect(dlq.jobs.size).toBe(0);
    expect(sourceQueue.jobs.size).toBe(1);
  });

  it("replay() on missing job returns { replayed: false }", async () => {
    const r = await service.replay(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      "missing",
    );
    expect(r.replayed).toBe(false);
  });

  it("discard() removes DLQ entry", async () => {
    await service.requeue(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      "job-1",
      "err",
      3,
      { x: 1 },
    );
    const dlq = dlqs.get("email_send_dlx")!;
    const dlqJobId = Array.from(dlq.jobs.keys())[0];
    const r = await service.discard(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      dlqJobId,
    );
    expect(r.discarded).toBe(true);
    expect(dlq.jobs.size).toBe(0);
  });

  it("discard() on missing job returns { discarded: false }", async () => {
    const r = await service.discard(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
      "missing",
    );
    expect(r.discarded).toBe(false);
  });

  it("getDlq() is idempotent — same source returns same DLQ", () => {
    const dlqA = service.getDlq(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
    );
    const dlqB = service.getDlq(
      "email_send",
      sourceQueue as unknown as import("bullmq").Queue,
    );
    expect(dlqA).toBe(dlqB);
  });
});
