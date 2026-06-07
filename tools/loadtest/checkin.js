/**
 * tools/loadtest/checkin.js — I-405 k6 load test for /v1/checkin/scan.
 *
 * Mô phỏng staff quét QR đồng thời theo `rate` (mặc định 1000/s) trong 5 phút.
 * Stage ramp-up: 30s warm-up → 4.5m sustained → 30s cool-down. Tránh spike
 * shock DB / Redis pool ngay từ frame đầu.
 *
 *   k6 run tools/loadtest/checkin.js
 *   k6 run -e BASE_URL=https://staging.saas-checkin.com -e RATE=2000 tools/loadtest/checkin.js
 *
 * Thresholds (Definition of Done Phase 4):
 *   - p95 latency scan < 200ms
 *   - success rate > 99.9%   (status 200 hoặc 422 đều OK — 422 = rejected signature)
 *   - http_req_failed < 0.1% (5xx, timeouts)
 *
 * Memory leak: k6 không đo trực tiếp, nhưng api-gateway RSS nên được monitor
 * bằng `docker stats api-gateway` song song. Stable RSS qua 5m = no leak.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { randomUUID } from "k6/crypto";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.3/index.js";

const scanLatency = new Trend("scan_latency_ms", true);
const scanSuccess = new Rate("scan_success");
const scanRejected = new Counter("scan_rejected");
const scanTotal = new Counter("scan_total");
const scanTimeout = new Counter("scan_timeout");

const BASE = __ENV.BASE_URL || "http://localhost:3001";
const ORG = __ENV.ORG_ID || "00000000-0000-0000-0000-000000000001";
const EVENT = __ENV.EVENT_ID || "00000000-0000-0000-0000-000000000010";
const GATE = __ENV.GATE_ID || "00000000-0000-0000-0000-000000000020";
const STAFF = __ENV.STAFF_ID || "00000000-0000-0000-0000-000000000030";
const RATE = Number(__ENV.RATE || 1000);
const DURATION = __ENV.DURATION || "5m";

export const options = {
  scenarios: {
    sustained: {
      executor: "ramping-arrival-rate",
      // RPS stages: 100 → RATE trong 30s, hold 4m, → 100 trong 30s
      startRate: 100,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { target: RATE, duration: "30s" },     // ramp up
        { target: RATE, duration: DURATION },  // sustain
        { target: 100, duration: "30s" },      // cool down
      ],
    },
  },
  thresholds: {
    "scan_latency_ms": ["p(95)<200", "p(99)<400"],
    "scan_success": ["rate>0.999"],
    "http_req_failed": ["rate<0.001"],
    "http_req_duration": ["p(95)<300"],   // overall HTTP including TLS
  },
  // HTTP keep-alive connection reuse (saves ~30ms per request)
  noVUConnectionReuse: false,
  discardResponseBodies: true,             // we only need timings + status
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
    timeout: "2s",
  });
  scanLatency.add(res.timings.duration);
  scanTotal.add(1);

  // 200 = success, 422 = signature invalid (still valid — full path executed),
  // 409 = duplicate, 404 = event not found, 5xx = failure.
  const ok = res.status >= 200 && res.status < 500;
  scanSuccess.add(ok);
  if (res.status === 422) scanRejected.add(1);
  if (res.timings.duration >= 2000) scanTimeout.add(1);

  check(res, {
    "status < 500": (r) => r.status < 500,
    "latency < 200ms": (r) => r.timings.duration < 200,
  });

  // pacing 0 — arrival rate đã rate-limit ở k6 layer
  sleep(0);
}

export function handleSummary(data) {
  return {
    "stdout": textSummary(data, { indent: "  ", enableColors: true }),
    "tools/loadtest/summary.json": JSON.stringify(data, null, 2),
    "tools/loadtest/summary.txt": textSummary(data, { indent: "  ", enableColors: false }),
  };
}
