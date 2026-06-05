# 0001. Stack & BFF topology

- **Status:** Superseded by [0013-dotnet-core-10-ddd.md](./0013-dotnet-core-10-ddd.md)
- **Date:** 2026-06-04

> **Lưu ý:** ADR này đã được supersede bởi ADR-0013 (chuyển từ Symfony sang .NET Core 10). Decision high-level (tách 2 backend: NestJS BFF + Core domain) vẫn còn; phần implementation core chuyển từ PHP sang C#.

## Context

Nền tảng cần hai concern rõ rệt:
1. **Domain logic** (event, registration, rule check-in, billing) — giàu, dễ thay đổi, phải diễn đạt invariant.
2. **I/O orchestration** (auth, REST/WS exposure, gọi API bên thứ ba, job queue, upload file) — lặp đi lặp lại, nặng framework.

Team sẽ bắt đầu với 2–3 dev full-stack biết TypeScript tốt, và 1 dev C# enterprise (.NET 6/7/8) có kinh nghiệm ASP.NET Core + EF Core.

## Decision

Dùng **hai backend** với separation of concern rõ ràng:

- **`apps/core-api`** — .NET Core 10 (DDD layered layout, custom base class). Sở hữu bounded context, aggregate, domain event, Outbox. Expose internal API qua gRPC và emit domain event sang MassTransit + RabbitMQ.
- **`apps/api-gateway`** — NestJS. Expose REST + WebSocket công khai, xử lý JWT auth, chạy BullMQ worker, gọi core-api qua gRPC.

Client (Next.js, Flutter) chỉ nói chuyện với `api-gateway`. Chúng không bao giờ thấy .NET Core 10.

Việc tách là **logic**, không nhất thiết vật lý. Ở MVP cả hai chạy chung docker-compose trên cùng VPS, nhưng boundary được enforce bằng code review và CI.

## Consequences

### Positive
- Mỗi team / dev làm việc trong một backend mà không dẫm chân nhau.
- NestJS chia sẻ type TypeScript với Next.js → không có impedance mismatch cho web.
- .NET Core 10 có ecosystem DDD trưởng thành (MassTransit, MediatR, EF Core, Stateless); type-safe end-to-end.
- Pattern BFF: gateway có thể swap (vd Go) mà không đụng vào domain.

### Negative
- Hai deploy target, hai CI pipeline, hai bộ dependency phải maintain.
- Contract gRPC thêm một lớp phải đồng bộ (giảm thiểu nhờ proto + codegen).
- Dev phải context-switch giữa 3 ngôn ngữ (TS, Dart, C#).

### Neutral
- Thêm ~1 dev-week overhead lúc start MVP. Hoàn vốn sau Phase 4.

## Alternatives considered

- **Gộp vào .NET** — bỏ NestJS, dùng ASP.NET Core cho gateway luôn. Bị loại vì:
  - WebSocket + BullMQ của Node có ecosystem mạnh hơn SignalR (MassTransit realtime khả thi nhưng ít phổ biến).
  - Buộc web/mobile dùng contract C# (hoặc tự viết TS).
  - Giấu tín hiệu team-size: nếu sau cần tách, chi phí refactor cao.
- **Chỉ NestJS** — bỏ .NET, viết DDD bằng TypeScript. Bị loại vì:
  - DDD pattern TypeScript (class-validator + TypeORM) dễ rơi vào anti-pattern anemic model.
  - Type system C# 14 + nullable reference types + Roslyn analyzers bắt mismatch ở compile-time.
- **Java + Spring** — hệ sinh thái DDD mạnh nhất, nhưng team thiếu kinh nghiệm Spring gần đây; start chậm.
- **Symfony 8.x (ban đầu chọn)** — supersede. Lý do: team strength lệch về C#, hiring dễ hơn, type-safe end-to-end.

## Revisit if

- Team < 3 dev cuối Phase 3.
- BFF trở thành thin pass-through — bỏ nó, route thẳng tới .NET.
