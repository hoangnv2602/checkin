# 0008. Style API: REST + OpenAPI, không GraphQL

- **Status:** Accepted (D7)
- **Date:** 2026-06-04

## Context

Hai style API khả thi cho client web + mobile:
- **REST + OpenAPI** — đơn giản, trưởng thành, dễ code-gen, dễ cache
- **GraphQL** — query linh hoạt, một round-trip, nhưng thêm độ phức tạp resolver, risk N+1, và overhead federation

Client của mình:
- **Next.js** — RSC fetch REST trực tiếp, không cần batch query chi tiết
- **Flutter** — chạy tốt với `dio` + `retrofit` codegen từ OpenAPI

Màn hình dashboard có một ít data lồng nhau (event + ticket-types + recent check-in), nhưng không đủ sâu để biện minh cho độ phức tạp của GraphQL ở MVP.

## Decision

Dùng **REST + JSON** với spec **OpenAPI 3.1** auto-gen từ decorator NestJS.

- Mọi endpoint version ở path `/v1/...`
- NestJS expose Swagger UI ở `/v1/docs` và spec ở `/v1/docs-json`
- `openapi-typescript` → TS client trong `packages/contracts/` cho Next.js
- `openapi-generator-cli` → Dart client cho Flutter
- CI fail khi OpenAPI change breaking trừ khi bump version
- gRPC nội bộ vẫn là gRPC (không REST) — xem ADR-0001

## Consequences

### Positive
- Stack đơn giản hơn; bớt một thứ phải học.
- HTTP caching dễ (`Cache-Control`, ETag).
- Codegen loại bỏ type client viết tay.
- Dễ curl / Postman / HTTPie để debug.

### Negative
- Vài trang dashboard cần 2–3 round-trip để lắp view.
- User mobile trên mạng chập chờn chịu chi phí nhiều request (giảm nhờ cache TanStack Query + retry dio).

### Neutral
- Nếu màn mobile tương lai cần nhiều quan hệ, có thể thêm `BFF aggregation endpoint` (REST) compose nhiều call .NET Core 10 trong 1 HTTP request từ gateway. Không cần GraphQL.
- OpenAPI UI: NestJS expose Swagger UI ở `/v1/docs` (public API); .NET Core 10 expose Scalar (OpenAPI 3.1 UI) ở `/scalar/v1` (internal API cho debug).

## Alternatives considered

- **GraphQL** — hoãn sang post-MVP nếu dashboard mobile trở nên phức tạp.
- **tRPC** — chỉ chạy TS-to-TS; không giúp được Flutter.
- **Custom RPC** — tái sinh gRPC, không có lý do.

## Revisit if

- Màn mobile cần 5+ round-trip / view
- Thêm client thứ ba (vd partner API) cần query linh hoạt
- Response time dashboard chiếm phần lớn khiếu nại user
