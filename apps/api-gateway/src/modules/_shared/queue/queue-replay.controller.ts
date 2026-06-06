/**
 * apps/api-gateway/src/modules/_shared/queue/queue-replay.controller.ts
 *
 * I-806 — Admin API: list + replay + discard DLQ entries.
 * Auth: x-internal-key + checkin-admin role.
 * UI ở apps/checkin-admin/src/modules/queue/components/DlqReplayPage.tsx.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { DlqService } from "./dlq.service";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

@Controller("v1/internal/queue")
export class QueueReplayController {
  constructor(
    private readonly dlq: DlqService,
    private readonly queues: Queue<unknown>[],
  ) {}

  private assertKey(key: string): void {
    if (key !== INTERNAL_API_KEY) throw new ForbiddenException("invalid internal key");
  }

  private findQueue(name: string): Queue {
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
}
