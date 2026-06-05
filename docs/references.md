# Tài liệu tham khảo

## Sách

- Vaughn Vernon — *Implementing Domain-Driven Design*
- Eric Evans — *Domain-Driven Design* (Reference)
- Chris Richardson — *Microservices Patterns*
- Sam Newman — *Monolith to Microservices*
- Martin Fowler — *Patterns of Enterprise Application Architecture*

## Framework & tool

- [Next.js 16 docs](https://nextjs.org/docs) — App Router, RSC, Server Actions
- [NestJS docs](https://docs.nestjs.com) — microservices, gRPC, BullMQ
- [.NET 10 docs](https://learn.microsoft.com/en-us/dotnet/) — C# 14, ASP.NET Core, EF Core
- [EF Core docs](https://learn.microsoft.com/en-us/ef/core/) — ORM, migrations, interceptors
- [Microsoft eShopOnContainers](https://github.com/dotnet-architecture/eShopOnContainers) — tham khảo pattern gRPC + CQRS + EventBus trong .NET
- [MediatR](https://github.com/LibertyJS/Liberty) — in-process CQRS / domain event
- [MassTransit](https://masstransit.io/documentation) — distributed event bus, outbox, saga
- [FluentValidation](https://docs.fluentvalidation.net/) — validation pipeline
- [Mapster](https://github.com/MapsterMapper/Mapster) — object mapping
- [Stateless](https://github.com/dotnet-state-machine/stateless) — state machine
- [Scalar](https://github.com/scalar/scalar) — OpenAPI 3.1 UI (thay Swagger UI)
- [xUnit](https://xunit.net/) + [FluentAssertions](https://fluentassertions.com/) + [Testcontainers](https://testcontainers.com/) + [NetArchTest](https://github.com/BenMorris/NetArchTest) — test stack
- [Serilog](https://serilog.net/) + [OpenTelemetry .NET](https://opentelemetry.io/docs/languages/dotnet/) — logging + tracing
- [Grpc.AspNetCore](https://learn.microsoft.com/en-us/aspnet/core/grpc/) — gRPC server
- [Pomelo.EntityFrameworkCore.PostgreSQL](https://github.com/PomeloFoundation/Pomelo.EntityFrameworkCore.MySql) — provider PG cho EF Core
- [Flutter docs](https://docs.flutter.dev)
- [drift (Dart SQLite)](https://drift.simonbinder.eu)
- [Riverpod](https://riverpod.dev)
- [Socket.IO](https://socket.io)
- [BullMQ](https://docs.bullmq.io)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Multi-tenant with EF Core](https://learn.microsoft.com/en-us/ef/core/miscellaneous/multitenancy)
- [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0)
- [Buf CLI (proto)](https://buf.build/docs)

## Nhà cung cấp

- [Stripe API reference](https://stripe.com/docs/api) — PaymentIntent, Webhook, Subscription
- [VNPay](https://sandbox.vnpayment.vn/apis/) — IPN, querydr, refund
- [Resend](https://resend.com/docs) — transactional email
- [Twilio](https://www.twilio.com/docs) — SMS
- [PostHog](https://posthog.com/docs) — product analytics (self-host)
- [Sentry](https://docs.sentry.io) — error tracking
- [Cloudflare](https://developers.cloudflare.com) — WAF, Workers, DNS
- [Hetzner Cloud](https://docs.hetzner.cloud) — VPS, Volumes, Storage Box

## Chuẩn

- [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/) — security baseline
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Conventional Commits](https://www.conventionalcommits.org)
- [Semantic Versioning](https://semver.org)
- [Keep a Changelog](https://keepachangelog.com)
- [GDPR](https://gdpr-info.eu) — cho xử lý dữ liệu tenant

## Vận hành

- [pgbackrest](https://pgbackrest.org) — Postgres backup / PITR
- [Ansible](https://docs.ansible.com) — provisioning
- [Caddy](https://caddyserver.com/docs/) — reverse proxy / HTTPS
- [Docker Compose](https://docs.docker.com/compose/)
- [Loki](https://grafana.com/oss/loki/) + [Tempo](https://grafana.com/oss/tempo/) + [Grafana](https://grafana.com)
- [OpenTelemetry](https://opentelemetry.io/docs/)
