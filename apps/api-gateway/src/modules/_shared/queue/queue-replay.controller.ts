/**
 * apps/api-gateway/src/modules/_shared/queue/queue-replay.controller.ts
 *
 * I-806 — Admin API: list + replay + discard DLQ entries.
 * Auth: x-internal-key header (gọi từ checkin-admin UI).
 * UI ở apps/checkin-admin/src/modules/queue/components/DlqReplayPage.tsx.
 */
import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { DlqService } from "./dlq.service";
import { MONITORED_QUEUES } from "./queue.module";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

@Controller("v1/internal/queue")
export class QueueReplayController {
  constructor(
    private readonly dlq: DlqService,
    @Inject(MONITORED_QUEUES) private readonly queues: Queue<unknown>[],
  ) {}

  private assertKey(key: string | undefined): void {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
  }

  private findQueue(name: string): Queue<unknown> {
    const q = this.queues.find((q) => q.name === name);
    if (!q) throw new BadRequestException(`unknown queue ${name}`);
    return q;
  }

  @Get(":queueName/dlq")
  async list(
    @Headers("x-internal-key") key: string,
    @Param("queueName") queueName: string,
    @Query("skip") skip = "0",
    @Query("take") take = "50",
  ) {
    this.assertKey(key);
    const q = this.findQueue(queueName);
    return this.dlq.list(queueName, q, Number(skip), Number(take));
  }

  @Post(":queueName/dlq/:dlqJobId/replay")
  async replay(
    @Headers("x-internal-key") key: string,
    @Param("queueName") queueName: string,
    @Param("dlqJobId") dlqJobId: string,
  ) {
    this.assertKey(key);
    const q = this.findQueue(queueName);
    return this.dlq.replay(queueName, q, dlqJobId);
  }

  @Delete(":queueName/dlq/:dlqJobId")
  async discard(
    @Headers("x-internal-key") key: string,
    @Param("queueName") queueName: string,
    @Param("dlqJobId") dlqJobId: string,
  ) {
    this.assertKey(key);
    const q = this.findQueue(queueName);
    return this.dlq.discard(queueName, q, dlqJobId);
  }

  /**
   * Queue depth metric cho Prometheus/Grafana.
   *  GET /v1/internal/queue/:queueName/depth
   */
  @Get(":queueName/depth")
  async depth(
    @Headers("x-internal-key") key: string,
    @Param("queueName") queueName: string,
  ) {
    this.assertKey(key);
    const q = this.findQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
      q.getDelayedCount(),
    ]);
    return { queue: queueName, waiting, active, completed, failed, delayed };
  }
}
