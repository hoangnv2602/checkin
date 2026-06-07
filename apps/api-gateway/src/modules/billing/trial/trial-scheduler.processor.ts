/**
 * apps/api-gateway/src/modules/billing/trial/trial-scheduler.processor.ts
 *
 * I-504 — BullMQ cron job daily: check subscriptions trial sắp hết hạn,
 * gửi email reminder T-3, T-1, T-0. Khi T-0 qua → downgrade về Free
 * (set state=Cancelled, set PlanId=FreePlanId, không delete data).
 */
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { EmailNotifierService } from "../../notification/email-notifier.service";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";
// BullMQ rejects queue names containing `:` (Redis key separator). Must
// match `^[A-Za-z0-9_-]+$`. See test/queue/queue-names.spec.ts.
export const TRIAL_SCHEDULER_QUEUE = "billing_trial_scheduler";

interface TrialJob {
  organizationId: string;
  subscriptionId: string;
  trialEndsAt: string;
  reminderDay: number;   // 3 | 1 | 0
}

@Processor(TRIAL_SCHEDULER_QUEUE)
export class TrialSchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(TrialSchedulerProcessor.name);

  constructor(private readonly notifier: EmailNotifierService) {
    super();
  }

  async process(job: Job<TrialJob>): Promise<{ sent: boolean }> {
    const { organizationId, trialEndsAt, reminderDay } = job.data;
    const buyer = await this.fetchOrgContact(organizationId);
    if (!buyer) {
      this.logger.warn(`no contact for org=${organizationId}; skip reminder`);
      return { sent: false };
    }
    const trialEnd = new Date(trialEndsAt);
    const formattedDate = trialEnd.toLocaleDateString("en-US", { dateStyle: "long" });

    await this.notifier.sendEventReminder({
      organizationId,
      organizationName: buyer.organizationName,
      attendeeEmail: buyer.email,
      attendeeName: buyer.name,
      eventTitle: "Your Pro trial",
      eventStartAt: formattedDate,
      venue: "SaasCheckin",
      relativeTime: reminderDay === 0 ? "today" : reminderDay === 1 ? "tomorrow" : `in ${reminderDay} days`,
      ticketUrl: `https://web.saas-checkin.com/${buyer.orgSlug}/billing`,
    });
    return { sent: true };
  }

  private async fetchOrgContact(orgId: string): Promise<{
    email: string;
    name: string;
    orgSlug: string;
    organizationName: string;
  } | null> {
    try {
      const res = await fetch(`${CORE_API_BASE}/v1/identity/orgs/${orgId}/owner`, {
        headers: { "X-Tenant-Id": orgId },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}
