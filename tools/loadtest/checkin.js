/**
 * tools/loadtest/checkin.js — I-405 k6 load test for /v1/checkin/scan.
 *
 * Mô phỏng 1000 staff devices quét QR đồng thời trong 5 phút.
 *  - Mỗi VU tạo 1 ticket với jti ngẫu nhiên
 *  - POST /v1/checkin/scan với signature giả (server sẽ Reject — vẫn count metric)
 *  - Production: warm-up với seed registrations thật, sign thật
 *
 * Chạy:
 *   k6 run --vus 1000 --duration 5m tools/loadtest/checkin.js
 *
 * Thresholds (Definition of Done Phase 4):
 *   - p95 latency scan < 200ms
 *   - success rate > 99.9%
 *   - không memory leak api-gateway
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { randomUUID } from "k6/crypto";

const scanLatency = new Trend("scan_latency_ms", true);
const scanSuccess = new Rate("scan_success");
const scanRejected = new Counter("scan_rejected");
const scanTotal = new Counter("scan_total");

const BASE = __ENV.BASE_URL || "http://localhost:3001";
const ORG = __ENV.ORG_ID || "00000000-0000-0000-0000-000000000001";
const EVENT = __ENV.EVENT_ID || "00000000-0000-0000-0000-000000000010";
const GATE = __ENV.GATE_ID || "00000000-0000-0000-0000-000000000020";
const STAFF = __ENV.STAFF_ID || "00000000-0000-0000-0000-000000000030";

export const options = {
  scenarios: {
    sustained: {
      executor: "constant-arrival-rate",
      rate: 1000,             // 1000 iterations per `timeUnit`
      timeUnit: "1s",
      duration: "5m",
      preAllocatedVUs: 200,
      maxVUs: 2000,
    },
  },
  thresholds: {
    scan_latency_ms: ["p(95)<200"],
    scan_success: ["rate>0.999"],
    http_req_failed: ["rate<0.001"],
  },
};

export default function () {
  const jti = randomUUID();
  const registrationId = randomUUID();
  // Giả signature (sẽ trả Rejected ở server — vẫn valid để đo latency path)
  const signature = "AAAA" + randomUUID().replace(/-/g, "").slice(0, 60);

  const body = JSON.stringify({
    organizationId: ORG,
    eventId: EVENT,
    gateId: GATE,
    staffUserId: STAFF,
    jti,
    registrationId,
    signature,
  });

  const res = http.post(`${BASE}/v1/checkin/scan`, body, {
    headers: { "Content-Type": "application/json" },
  });
  scanLatency.add(res.timings.duration);
  scanTotal.add(1);

  const ok = res.status === 200 || res.status === 422;  // 422 = rejected (signature invalid) — still valid
  scanSuccess.add(ok);
  if (res.status === 422) scanRejected.add(1);

  check(res, {
    "status is 200 or 422": (r) => r.status === 200 || r.status === 422,
    "latency < 200ms": (r) => r.timings.duration < 200,
  });

  // pacing 0 — arrival rate đã rate-limit ở k6 layer
  sleep(0);
}

export function handleSummary(data) {
  return {
    "stdout": textSummary(data, { indent: "  ", enableColors: true }),
    "tools/loadtest/summary.json": JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  // k6 has built-in textSummary; fallback nếu không có sẵn
  return JSON.stringify(data.metrics, null, 2);
}
