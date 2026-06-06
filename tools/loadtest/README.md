# k6 load test — check-in scan (I-405)

Mô phỏng 1000 staff devices quét QR đồng thời trong 5 phút.

## Chạy local

```bash
# Cần: k6 đã cài (https://k6.io/docs/getting-started/installation/)
# cần: api-gateway đang chạy ở localhost:3001
# cần: core-api + Postgres + Redis
cd tools/loadtest
k6 run --vus 1000 --duration 5m checkin.js
```

## Chạy trên staging

```bash
BASE_URL=https://api.staging.saas-checkin.com \
ORG_ID=<tenant-id> \
EVENT_ID=<event-id> \
GATE_ID=<gate-id> \
STAFF_ID=<staff-user-id> \
k6 run --vus 1000 --duration 5m checkin.js
```

## Thresholds (Definition of Done Phase 4)

| Metric | Target |
|--------|--------|
| `scan_latency_ms` p95 | < 200ms |
| `scan_success` rate | > 99.9% |
| `http_req_failed` rate | < 0.1% |
| api-gateway memory | không leak (RSS stable trong 5m) |

## Cách đọc kết quả

- `scan_latency_ms`: p50, p95, p99 — percentile latency
- `scan_success`: 200 + 422 (rejected signature vẫn OK cho load test)
- `scan_rejected`: 422 count — khi chạy với real signature sẽ thấp; với fake signature sẽ cao (~99%)

## Các scenario khác

```bash
# 100 MAU traffic (steady)
k6 run --vus 100 --duration 30m checkin.js

# Spike test
k6 run --stage 30s:100,30s:2000,30s:100 checkin.js
```
