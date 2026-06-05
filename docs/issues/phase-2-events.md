# Phase 2 — Event Management (Tuần 4–5)

> **Mục tiêu:** Organizer có thể CRUD event, session, venue từ dashboard.
> **Phụ thuộc:** Phase 1 (Identity, RBAC).

## Backlog

### I-201 · [L] .NET Core 10 EventManagement context (bounded-context module)
- Aggregate (trong `src/SaasCheckin.Domain/EventManagement/Aggregates/`): `Event` (root), `Session`, `Venue`
- VO (record): `EventPeriod`, `Capacity`, `GeoLocation`
- Invariant enforce trong aggregate:
  - `capacity > 0`
  - `startAt < endAt`
  - Event đã publish không được giảm `capacity` xuống dưới `soldTickets` (đếm registration đã issue)
- State machine dùng **Stateless** library: `Draft → Published → Cancelled | Completed`
- Use case: `CreateEvent`, `UpdateEvent`, `PublishEvent`, `CancelEvent`, `AddSession`, `AddVenue` (MediatR command handler)
- Domain event: `EventPublished`, `EventCancelled`, `SessionRescheduled`
- Integration event: `EventPublishedIntegrationEvent` (publish qua MassTransit; `Registration` context consume để mở bán ticket)
- gRPC service: `EventService`, `VenueService` (host trong `SaasCheckin.HttpApi.Host`)
- RLS trên mọi bảng (qua EF Core migration + `TenantDbConnectionInterceptor`)
- Bounded-context module class `EventManagementModule` tự đăng ký DI

### I-202 · [M] NestJS events module
- REST endpoint theo API spec §6
- gRPC client tới .NET Core 10
- Read-through Redis cache cho `GET /v1/events/{id}` (TTL 5 phút)
- Invalidate cache khi mutation
- Pagination + filter theo status

### I-203 · [L] Next.js dashboard — Events CRUD
- `/[orgSlug]/events` — list với filter status, search, pagination
- `/[orgSlug]/events/new` — form nhiều bước (thông tin cơ bản → venue → session)
- `/[orgSlug]/events/[eventId]` — detail view có edit
- `/[orgSlug]/events/[eventId]/publish` — modal xác nhận
- zod schema gen từ OpenAPI cho validation form
- Optimistic update qua TanStack Query

### I-204 · [M] Integration test
- gRPC contract test client/server (buf breaking trên proto)
- End-to-end test: tạo event qua UI → verify trong DB → publish → fetch qua API

---

## Definition of Done

- [ ] Organizer tạo được event draft với venue + 2 session
- [ ] Action publish chuyển status; event đã hủy không edit được
- [ ] Capacity không giảm được xuống dưới registration đã issue (server reject)
- [ ] List dashboard load < 500 ms với 100 event
- [ ] Mọi test Phase 2 xanh trên CI
