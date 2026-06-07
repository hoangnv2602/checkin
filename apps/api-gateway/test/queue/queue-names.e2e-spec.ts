/**
 * apps/api-gateway/test/queue/queue-names.e2e-spec.ts
 *
 * Regression test for "Queue name cannot contain :" crash at boot.
 *
 * BullMQ validates queue names against `^[A-Za-z0-9_-]+$` because Redis
 * uses `:` as an internal key separator. A `:` in a queue name is rejected
 * at module-init time with:
 *
 *   Error: Queue name cannot contain :
 *     at new QueueBase (bullmq/src/classes/queue-base.ts:63:13)
 *     at createQueueAndWorkers (@nestjs/bullmq/dist/bull.providers.js)
 *
 * This test enumerates every BullMQ queue constant exported by the
 * api-gateway and asserts each matches the regex. If anyone reintroduces
 * a `:` in a queue name, this test fails before the dev server crashes.
 *
 * Add new queue constants to the array below when introducing new
 * BullMQ queues.
 */
import { describe, it, expect } from "vitest";
import { EMAIL_SEND_QUEUE } from "../../src/modules/notification/email-notifier.service";
import { CHAT_SEND_QUEUE } from "../../src/modules/notification/chat-notifier.service";
import { QR_GENERATE_QUEUE } from "../../src/modules/qr/worker/qr-generator.processor";
import { WEBHOOK_DELIVERY_QUEUE } from "../../src/modules/webhooks/webhook.service";
import { PAYMENT_SWEEP_QUEUE } from "../../src/modules/billing/payments/jobs/pending-order-sweeper";
import { TRIAL_SCHEDULER_QUEUE } from "../../src/modules/billing/trial/trial-scheduler.processor";

// BullMQ's regex: `^[A-Za-z0-9_-]+$` — see bullmq/src/classes/queue-base.ts
const BULLMQ_QUEUE_NAME_RE = /^[A-Za-z0-9_-]+$/;

describe("BullMQ queue names", () => {
  // Tuple of [name, value] for clear failure messages.
  const queues: ReadonlyArray<readonly [string, string]> = [
    ["EMAIL_SEND_QUEUE", EMAIL_SEND_QUEUE],
    ["CHAT_SEND_QUEUE", CHAT_SEND_QUEUE],
    ["QR_GENERATE_QUEUE", QR_GENERATE_QUEUE],
    ["WEBHOOK_DELIVERY_QUEUE", WEBHOOK_DELIVERY_QUEUE],
    ["PAYMENT_SWEEP_QUEUE", PAYMENT_SWEEP_QUEUE],
    ["TRIAL_SCHEDULER_QUEUE", TRIAL_SCHEDULER_QUEUE],
  ];

  it.each(queues)("%s = %j matches BullMQ regex ^[A-Za-z0-9_-]+$", (_name, value) => {
    expect(value).toMatch(BULLMQ_QUEUE_NAME_RE);
    expect(value).not.toContain(":");
  });

  it("queue names are unique across the codebase (no two queues share a name)", () => {
    const names = queues.map(([, v]) => v);
    expect(new Set(names).size).toBe(names.length);
  });
});
