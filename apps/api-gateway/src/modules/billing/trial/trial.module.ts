/**
 * apps/api-gateway/src/modules/billing/trial/trial.module.ts
 */
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { TrialProvisioner } from "./trial-provisioner.service";
import { TrialSchedulerProcessor, TRIAL_SCHEDULER_QUEUE } from "./trial-scheduler.processor";
import { TrialScheduler } from "./trial-scheduler.scheduler";
import { NotificationModule } from "../../notification/notification.module";

@Module({
  imports: [BullModule.registerQueue({ name: TRIAL_SCHEDULER_QUEUE }), NotificationModule],
  providers: [TrialProvisioner, TrialSchedulerProcessor, TrialScheduler],
  exports: [TrialProvisioner],
})
export class TrialModule {}
