# Phase 4 — Check-in Core (Tuần 8–10)  ← **RỦI RO CAO**

> **Mục tiêu:** Staff quét QR attendee trong app Flutter; dashboard cập nhật realtime; offline sync hoạt động.
> **Phụ thuộc:** Phase 3 (đã có registration).

## Backlog

### I-401 · [L] .NET Core 10 CheckIn context (bounded-context module)
- Aggregate (trong `src/SaasCheckin.Domain/CheckIn/Aggregates/`): `CheckInRecord` (root) — kế thừa `FullAuditedAggregateRoot<Guid>`, `IMultiTenant`
- VO (record): `QrPayload`, `GateId`, `CheckInStatus` (`Success` | `Rejected` | `Duplicate`)
- Domain service: `IQrSignatureVerifier` (verify Ed25519, nhận thức xoay key)
- Specification: `CanCheckInSpecification` (event live, không trùng, gate thuộc venue)
- Use case: `ScanQr`, `ManualCheckIn`, `UndoCheckIn` (chỉ owner)
- Domain event: `AttendeeCheckedIn`, `CheckInRejected`, `SuspiciousDuplicate`
- Partial unique index `(registration_id) WHERE status = 'Success'` — migrate qua EF Core `HasFilter("status = 'Success'").IsUnique()` trong `IEntityTypeConfiguration<CheckInRecord>`
- gRPC: `CheckInService.Scan`, `UndoCheckIn`, `ListCheckIns`, `GetEventStats` (host trong `SaasCheckin.HttpApi.Host`)
- Hot read cache qua `StackExchange.Redis` (`ICheckInCache` trong `SaasCheckin.Infrastructure`): `event:{eventId}:checkin_count`, `reg:{regId}:status`

### I-402 · [L] NestJS realtime gateway
- Socket.IO server với Redis adapter cho cross-instance fanout
- Namespace: `event:{eventId}:checkin`
- Middleware auth: verify JWT, set `tenantId` và `userId` trên socket
- Room: theo event
- Emit: `AttendeeCheckedIn`, `CheckInRejected`, `StatsUpdated`
- Throttle emit ≤ 1 / 250ms / event để tránh flood
- Reconnect WebSocket với exponential backoff trên Flutter

### I-403 · [L] Flutter scan + offline sync
- Tích hợp `mobile_scanner` trong `scan_screen`
- Verify offline: cache JWKS trong `flutter_secure_storage`, verify Ed25519 bằng package `cryptography`
- Khi scan: insert vào bảng drift `pending_checkin`, hiện ✓ ngay
- Tác vụ định kỳ `workmanager` (15s) drain queue
- Sync: `POST /v1/checkin/scan` mỗi record, xử lý 200/409/5xx
- Màn hình manual check-in có search
- Phản hồi haptic + audio khi success/reject

### I-404 · [M] Next.js dashboard realtime
- Trang `/[orgSlug]/events/[eventId]/checkin`
- Subscribe namespace `event:{eventId}:checkin`
- Biểu đồ: line tích lũy, bar 30s rolling, leaderboard top-gate
- Alert strip cho số đếm duplicate đáng ngờ
- Live counter: `X / Y checked in`
- Optimistic update qua React Query `setQueryData`

### I-405 · [M] Load test (k6)
- Script trong `tools/loadtest/checkin.js`
- Mô phỏng 1000 scan đồng thời / giây trong 5 phút
- Assert p95 latency scan < 200ms
- Assert success rate > 99.9%
- Assert không memory leak trong api-gateway

### I-406 · [M] Chaos test
- Redis down: dashboard degrade graceful (chế độ read-only), check-in vẫn hoạt động (ghi DB, outbox queue event)
- DB chậm (latency 1s): scan vẫn trả < 1s
- Phân vùng mạng giữa NestJS và .NET Core 10: queue scan trong api-gateway, retry khi reconnect
- Test trong staging env riêng

---

## Definition of Done

- [ ] Staff quét QR trong Flutter → dashboard cập nhật < 1s
- [ ] Scan offline → kết nối mạng → sync trong vòng 15s
- [ ] Scan trùng trả 409, dashboard hiển thị "already checked in"
- [ ] QR giả (chữ ký sai) trả 422, log `CheckInRejected`
- [ ] k6 1000 scan đồng thời / giây: p95 < 200ms, 0% error
- [ ] Chaos test pass
- [ ] Mọi test Phase 4 xanh trên CI
