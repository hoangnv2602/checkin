/**
 * apps/api-gateway/src/modules/_shared/queue/queue.tokens.ts
 *
 * I-806 — DI tokens for the shared queue module.
 *
 * `MONITORED_QUEUES` is the token that feature modules (e.g. NotificationModule)
 * inject into their `onApplicationBootstrap` to push their BullMQ `Queue`
 * instances into a single array. The StuckJobDetectorProcessor then sweeps
 * all registered queues every minute to mark stuck jobs as failed and move
 * them to DLQ.
 *
 * IMPORTANT: this file MUST be a leaf (no imports from the queue module /
 * processors) to avoid a circular import. When `queue.module.ts` and
 * `stuck-job-detector.processor.ts` import the token from this file, the
 * dependency graph becomes:
 *
 *   queue.module.ts ──┐
 *                     ├─→ queue.tokens.ts
 *   stuck-job-detector│
 *   .processor.ts  ───┘
 *
 * which is a DAG, not a cycle. Earlier, both files imported the token from
 * `queue.module.ts` directly, producing a cycle that NestJS's DI couldn't
 * resolve — `MONITORED_QUEUES` would resolve to a different reference at
 * class-decoration time vs. provider-registration time, surfacing as:
 *
 *   UndefinedDependencyException: Nest can't resolve dependencies of the
 *   StuckJobDetectorProcessor (DlqService, ?). The argument <token> at
 *   index [1] is unavailable in the QueueModule module.
 *
 * Moving the token to its own module breaks the cycle.
 */

export const MONITORED_QUEUES = "MONITORED_QUEUES";
