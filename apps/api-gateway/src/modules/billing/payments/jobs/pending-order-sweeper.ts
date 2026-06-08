/**
 * apps/api-gateway/src/modules/billing/payments/jobs/pending-order-sweeper.ts
 *
 * I-302 — Worker poll order pending > 10 phút, mark failed. Đề phòng
 * webhook lost (network partition, provider downtime) — sweep mỗi 60s.
 */
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { StripeAdapter } from "../adapters/stripe.adapter";
import { VnpayAdapter } from "../adapters/vnpay.adapter";

// BullMQ rejects queue names containing `:` (Redis key separator). Must
// match `^[A-Za-z0-9_-]+$`. See test/queue/queue-names.spec.ts.
export const PAYMENT_SWEEP_QUEUE = "payment_sweep";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

@Processor(PAYMENT_SWEEP_QUEUE)
export class PendingOrderSweeper extends WorkerHost {
  private readonly logger = new Logger(PendingOrderSweeper.name);

  constructor(
    private readonly stripe: StripeAdapter,
    private readonly vnpay: VnpayAdapter,
  ) {
    super();
  }

  async process(job: Job): Promise<{ swept: number; paid: number; failed: number }> {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const res = await fetch(`${CORE_API_BASE}/v1/registration/orders/pending-expired?cutoff=${cutoff}&take=100`, {
      headers: { "X-Tenant-Id": "00000000-0000-0000-0000-000000000000" },
    });
    if (!res.ok) {
      this.logger.warn(`sweep list failed: ${res.status}`);
      return { swept: 0, paid: 0, failed: 0 };
    }
    const orders = (await res.json()) as Array<{ id: string; organizationId: string; providerSessionId: string | null; provider: string }>;
    let paid = 0, failed = 0;
    for (const o of orders) {
      if (!o.providerSessionId) {
        // No session → directly mark failed (timeout without payment start)
        await this.markFailed(o.organizationId, o.id, "expired_no_session");
        failed++;
        continue;
      }
      const status = await (o.provider === "stripe" ? this.stripe : this.vnpay).checkStatus(o.providerSessionId);
      if (status.status === "paid") {
        await this.markPaid(o.organizationId, o.id, o.providerSessionId);
        paid++;
      } else if (status.status === "failed" || status.status === "expired") {
        await this.markFailed(o.organizationId, o.id, status.status);
        failed++;
      }
      // pending → leave; next sweep sẽ check
    }
    this.logger.log(`sweep done: ${orders.length} swept, ${paid} paid, ${failed} failed`);
    return { swept: orders.length, paid, failed };
  }

  private async markPaid(orgId: string, orderId: string, sessionId: string) {
    await fetch(`${CORE_API_BASE}/v1/registration/orders/${orderId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": orgId },
      body: JSON.stringify({ organizationId: orgId, providerSessionId: sessionId }),
    });
  }

  private async markFailed(orgId: string, orderId: string, reason: string) {
    await fetch(`${CORE_API_BASE}/v1/registration/orders/${orderId}/mark-failed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": orgId },
      body: JSON.stringify({ organizationId: orgId, reason }),
    });
  }
}
