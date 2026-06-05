# Phase 6 — Polish & Analytics (Tuần 13–14)

> **Mục tiêu:** Observability production-ready, báo cáo hữu ích, UX bóng bẩy.
> **Phụ thuộc:** Phase 1–5 chạy end-to-end.

## Backlog

### I-601 · [M] Báo cáo & analytics
- `/[orgSlug]/events/[eventId]/stats`:
  - Tổng check-in, tỉ lệ no-show, time-to-checkin (avg, p50, p95)
  - Peak gate + peak time
  - Cohort: đã đăng ký vs đã tham dự theo loại vé
  - Xuất CSV
- Query aggregate qua .NET Core 10 read-model projection (giữ cập nhật bằng domain event)

### I-602 · [M] Audit log viewer (Owner)
- `/[orgSlug]/settings/audit` — list phân trang ai làm gì khi nào
- Filter: actor, action, khoảng ngày
- Bảng `audit_log` immutable; chỉ INSERT qua role DB

### I-603 · [M] Rollout Sentry + OpenTelemetry
- Sentry: web (Next.js), mobile (Flutter), api-gateway (NestJS), core-api (.NET Core 10)
- OpenTelemetry: trace context lan truyền từ web → api-gateway → core-api → DB
- OTLP exporter → Tempo
- Sample rate: 100% error, 10% trace

### I-604 · [S] Tài liệu
- API reference auto-publish sang internal docs site (mkdocs)
- Runbook vận hành:
  - `initial-deploy.md`
  - `add-new-vps.md`
  - `db-restore.md`
  - `rotate-jwt-keys.md`
  - `incident-response.md`
- Tài liệu onboarding cho dev mới

### I-605 · [S] UX polish
- Empty state cho mọi trang list
- Loading skeleton (không spinner) cho query chậm
- Error boundary có retry
- Toast notification
- Phím tắt cho power user (event list, dashboard)

### I-606 · [M] i18n
- next-intl: EN (mặc định), VI, JP
- intl trong Flutter: EN, VI
- Mọi string user-facing được extract
- Pseudo-locale (`en-XA`) test trong CI cho vấn đề layout

---

## Definition of Done

- [ ] Báo cáo load < 2s cho event có 10k registration
- [ ] Xuất CSV hoạt động cho mọi báo cáo
- [ ] Audit log immutable; viewer hoạt động
- [ ] Sentry nhận error từ cả 4 app
- [ ] Trace OpenTelemetry hiển thị trong Tempo
- [ ] 3 locale (EN, VI, JP) dùng được trên web
- [ ] Mọi test Phase 6 xanh trên CI
