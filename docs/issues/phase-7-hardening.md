# Phase 7 — Beta & Hardening (Tuần 15–16)

> **Mục tiêu:** Launch production. Security đã review, backup đã verify, submit store xong.
> **Phụ thuộc:** Tất cả phase trước.

## Backlog

### I-701 · [M] Security review
- Chạy checklist [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/) Level 2
- Pen-test: SQLi, XSS, CSRF, IDOR, auth bypass, rate limit
- Audit dependency: `npm audit`, `dotnet list package --vulnerable`, `dotnet outdated`, `dart pub outdated`
- Scan image container: Trivy trên tất cả image
- Fix mọi finding critical / high

### I-702 · [M] Drill backup / restore
- Restore đầy đủ từ backup `pgbackrest` sang instance DB sạch
- Verify toàn bộ dữ liệu, không corruption
- Đo thời gian restore (target: < 4h)
- Document runbook `db-restore.md`
- Lặp lại mỗi quý

### I-703 · [M] Onboarding wizard
- Org mới đăng ký → setup có hướng dẫn:
  1. Xác nhận email
  2. Tạo event đầu tiên (template: "Conference")
  3. Thêm staff đầu tiên
  4. Publish event
  5. Share link đăng ký
- Có thể skip nhưng nổi bật
- Mỗi bước lưu state; resume được

### I-704 · [M] Performance tuning
- Profile: scenario 1000 MAU trong staging
- Xác định query chậm (pg_stat_statements)
- Thêm index / viết lại query khi cần
- Cache hit rate Redis > 80% trên hot path
- Dashboard TTFB < 200ms

### I-705 · [M] Submit store
- **Apple App Store** (Flutter iOS):
  - Listing App Store Connect
  - Screenshot, mô tả, keyword
  - URL privacy policy
  - TestFlight external testing trước
- **Google Play** (Flutter Android):
  - Listing Play Console
  - Internal testing track trước
  - Sau đó closed testing → production
- Submit ít nhất 5 ngày làm việc trước launch target

### I-706 · [S] Checklist launch production
- [ ] Mọi env var đã set trong `/etc/<service>/.env` trên htz-app-1, htz-db-1
- [ ] DNS record trỏ qua Cloudflare
- [ ] SSL xanh, HSTS bật
- [ ] Monitoring xanh: Sentry, Uptime Kuma, Grafana
- [ ] Alert đã wire: kênh Telegram/Discord
- [ ] Backup verified hôm nay
- [ ] Smoke test trên prod: register → pay → check-in
- [ ] Status page public (hoặc chỉ URL public của Uptime Kuma)
- [ ] Email support đã cấu hình

---

## Definition of Done

- [ ] OWASP ASVS L2: không có finding critical / high
- [ ] Drill restore DB thành công trong RTO
- [ ] Onboarding wizard end-to-end hoạt động
- [ ] p95 dashboard load < 500ms
- [ ] App được duyệt trên cả 2 store (hoặc đang review với target date)
- [ ] Launch runbook chạy không có sự cố
- [ ] **MVP SHIPPED 🎉**
