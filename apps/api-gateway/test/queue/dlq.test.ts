/**
 * apps/api-gateway/test/queue/dlq.test.ts
 *
 * I-806 — Unit test cho DlqService với mock BullMQ Queue.
 */
import { DlqService } from "../../src/modules/_shared/queue/dlq.service";
import { dlqName, DEFAULT_JOB_OPTIONS } from "../../src/modules/_shared/queue/queue-defaults";

const mockDlqAdd = jest.fn();
const mockDlqGetJobs = jest.fn();
const mockDlqGetJob = jest.fn();
const mockJobRemove = jest.fn();

const fakeDlq = {
  add: mockDlqAdd,
  getJobs: mockDlqGetJobs,
  getJob: mockDlqGetJob,
};

const fakeSourceQueue = {
  name: "test:queue",
  opts: { connection: { host: "localhost", port: 6379 } },
  add: jest.fn(),
};

describe("queue-defaults", () => {
  it("attempts = 3, exponential backoff", () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({ type: "exponential", delay: 1000 });
  });
  it("dlqName append :dlx suffix", () => {
    expect(dlqName("email:send")).toBe("email:send:dlx");
  });
});

describe("DlqService", () => {
  let svc: DlqService;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new DlqService();
    // Stub internal lazy init
    (svc as unknown as { _dlqs: Map<string, unknown> })._dlqs.set(
      fakeSourceQueue.name,
      fakeDlq,
    );
  });

  it("requeue gọi dlq.add với structured data", async () => {
    await svc.requeue(
      fakeSourceQueue.name,
      fakeSourceQueue as never,
      "job-123",
      "downstream timeout",
      3,
      { foo: "bar" },
    );
    expect(mockDlqAdd).toHaveBeenCalledWith(
      "dlq",
      expect.objectContaining({
        originalQueue: fakeSourceQueue.name,
        originalJobId: "job-123",
        failedReason: "downstream timeout",
        attemptsMade: 3,
        movedAt: expect.any(String),
        payload: { foo: "bar" },
      }),
      expect.objectContaining({ jobId: expect.stringMatching(/^test:queue:job-123:\d+$/) }),
    );
  });

  it("list trả về entries mapped từ jobs", async () => {
    mockDlqGetJobs.mockResolvedValue([
      {
        id: "dlq-1",
        data: {
          originalQueue: "test:queue",
          originalJobId: "job-1",
          failedReason: "boom",
          attemptsMade: 3,
          movedAt: "2026-06-06T00:00:00Z",
          payload: { hello: "world" },
        },
      },
    ]);
    const entries = await svc.list(fakeSourceQueue.name, fakeSourceQueue as never);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("dlq-1");
    expect(entries[0].failedReason).toBe("boom");
    expect(entries[0].data).toEqual({ hello: "world" });
  });

  it("replay move payload ngược lại source queue + remove khỏi dlq", async () => {
    mockDlqGetJob.mockResolvedValue({
      id: "dlq-1",
      data: { payload: { original: true } },
      remove: mockJobRemove,
    });
    const result = await svc.replay(fakeSourceQueue.name, fakeSourceQueue as never, "dlq-1");
    expect(result.replayed).toBe(true);
    expect(fakeSourceQueue.add).toHaveBeenCalledWith("replay", { original: true }, expect.any(Object));
    expect(mockJobRemove).toHaveBeenCalled();
  });

  it("discard remove DLQ job", async () => {
    mockDlqGetJob.mockResolvedValue({ id: "dlq-1", remove: mockJobRemove });
    const result = await svc.discard(fakeSourceQueue.name, fakeSourceQueue as never, "dlq-1");
    expect(result.discarded).toBe(true);
    expect(mockJobRemove).toHaveBeenCalled();
  });

  it("replay trả false nếu DLQ job không tồn tại", async () => {
    mockDlqGetJob.mockResolvedValue(null);
    const result = await svc.replay(fakeSourceQueue.name, fakeSourceQueue as never, "missing");
    expect(result.replayed).toBe(false);
  });
});
