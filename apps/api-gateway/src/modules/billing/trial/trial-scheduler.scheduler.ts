/**
 * apps/api-gateway/src/modules/billing/trial/trial-scheduler.scheduler.ts
 *
 * I-504 — Cron schedule daily check trial expiring.
 * BullMQ repeatable job mỗi 24h, query subscriptions sắp hết hạn, enqueue
 * reminder job T-3 / T-1 / T-0.
 */
import { Inject, Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { TRIAL_SCHEDULER_QUEUE } from "./trial-scheduler.processor";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

@Injectable()
export class TrialScheduler implements OnModuleInit {
  private readonly logger = new Logger(TrialScheduler.name);

  constructor(
    @Optional() @InjectQueue(TRIAL_SCHEDULER_QUEUE) private readonly queue?: Queue,
  ) {}

  async onModuleInit() {
    if (!this.queue) {
      this.logger.warn("BullMQ not configured; trial scheduler inactive");
      return;
    }
    await this.queue.add(
      "daily-check",
      {},
      {
        repeat: { pattern: "0 9 * * *" },  // 9am UTC daily
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    this.logger.log("trial daily-check job scheduled (9am UTC)");
  }
}
