# Chaos test scenarios (I-406)

Mô phỏng failure modes để verify resilience trong staging environment.

## Scenarios

| File | Mô tả | Expectation |
|------|-------|-------------|
| `redis-down.sh` | Stop Redis container 30s | Scan vẫn work (write DB), dashboard degrade read-only |
| `db-slow.sh` | Pause Postgres 30s (sim 1s latency) | Scan vẫn trả < 2s nhờ Redis cache |
| `network-partition.sh` | Pause core-api 30s | Mobile queue offline, reconnect drain queue |

## Chạy

```bash
# cần: docker compose running + api-gateway + core-api healthy
bash tools/chaos/scenarios/redis-down.sh
bash tools/chaos/scenarios/db-slow.sh
bash tools/chaos/scenarios/network-partition.sh
```

## Production (toxiproxy)

Trên staging Hetzner, swap docker pause cho toxipro proxy:

```bash
# Thêm toxiproxy vào docker-compose
# Wrap Postgres connection qua proxy
toxi-cli toxic add -n slow -t latency -a latency=1000 postgres
sleep 30
toxi-cli toxic remove -n slow postgres
```

## Pass criteria

- **Redis down**: scan 200/422, dashboard /v1/checkin/stats trả 200 (DB fallback)
- **DB slow**: scan latency < 2s (cache + timeout)
- **Network partition**: scan fail (502/503/504) trong partition, recover sau khi unpause
- Sau khi recover: full flow hoạt động bình thường, không có data corruption

## Liên kết

- Staging env config: `infra/ansible/playbooks/staging.yml`
- k6 load test (I-405): `tools/loadtest/checkin.js`
- Definition of Done Phase 4: `docs/issues/phase-4-checkin.md`
