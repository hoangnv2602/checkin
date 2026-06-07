# DLQ + retry policy runbook (I-806)

> **Phase 8 — Scale.** Mọi BullMQ queue trong `apps/api-gateway` đều dùng
> `DEFAULT_JOB_OPTIONS` (3 retries, exponential 1s → 5s → 30s) và auto-promote
> exhausted jobs sang `<queue>_dlx` qua `BaseDlqProcessor.onFailed()`.

## TL;DR

- Retry policy đã set global qua `apps/api-gateway/src/modules/_shared/queue/queue-defaults.ts`
- Sau 3 lần fail, job tự move sang `*_dlx` cùng tên, retention 7 ngày
- Stuck-job detector quét mỗi phút, mark failed nếu `active > 5 phút` → DLQ
- Admin UI: `apps/checkin-admin/src/modules/queue/components/DlqReplayPage.tsx`
- Admin API: `GET /v1/internal/queue/:queueName/dlq`, `POST .../replay`, `DELETE .../:dlqJobId`
- Auth: header `x-internal-key: $INTERNAL_API_KEY` (chỉ checkin-admin có)

## Cấu trúc

```
apps/api-gateway/src/modules/_shared/queue/
├── queue-defaults.ts            # DEFAULT_JOB_OPTIONS, dlqName() sanitizer
├── dlq.service.ts               # requeue / list / replay / discard
├── base-dlq-processor.ts        # abstract base — auto-promote to DLQ on exhaustion
├── queue-replay.controller.ts   # GET dlq, POST replay, DELETE, GET depth
├── queue.module.ts              # global module, exposes DlqService + MONITORED_QUEUES
└── stuck-job-detector.processor.ts  # @Cron(EVERY_MINUTE) sweep
```

## Thêm queue mới

Processor phải extend `BaseDlqProcessor` thay vì `WorkerHost` để auto-DLQ:

```ts
import { Processor, InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { BaseDlqProcessor } from "../_shared/queue/base-dlq-processor";
import { DlqService } from "../_shared/queue/dlq.service";

@Processor("my:queue")
export class MyProcessor extends BaseDlqProcessor<MyJob, MyResult> {
  constructor(
    private readonly svc: MyService,
    dlq: DlqService,
    @InjectQueue("my:queue") queue: Queue<MyJob>,
  ) {
    super(dlq, queue);
  }
  async process(job: Job<MyJob>): Promise<MyResult> { ... }
}
```

Sau đó register queue vào `MONITORED_QUEUES` trong `onApplicationBootstrap`:

```ts
onApplicationBootstrap() {
  this.monitored.push(this.myQueue);
}
```

## Monitoring

- Queue depth: `GET /v1/internal/queue/:queueName/depth` (waiting/active/completed/failed/delayed)
- Stuck jobs: log `[StuckJobDetectorProcessor] stuck queue=...` mỗi phút
- DLQ growth: log `[DlqService] dlq.move queue=...`
- Grafana: scrape từ `/metrics` (Prometheus exporter trong observability module)

## On-call playbook

**DLQ depth > 0 cho queue X:**

1. Mở `https://admin.saas-checkin.com/queues/X/dlq` (checkin-admin)
2. Inspect `failedReason` + `attemptsMade` cho từng entry
3. Nếu transient (network, 5xx provider): **Replay All** sau khi fix root cause
4. Nếu poison data (4xx): **Discard** hoặc **Edit payload → Replay**
5. Verify queue depth về 0 + metric `queue_failed_total` giảm

**Job stuck > 5 phút:**

1. Check `queue:active` count — nếu > 0 mà job không progress → worker chết
2. Restart workers (`docker compose restart api-gateway`)
3. Stuck detector sẽ tự move sang DLQ ở lần sweep kế tiếp
4. Replay từ DLQ sau khi workers ổn định
