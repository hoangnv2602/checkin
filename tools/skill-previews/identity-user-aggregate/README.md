# User aggregate preview — Phase 1 I-101

> **Trạng thái:** PREVIEW — scaffold tham khảo, KHÔNG phải source code chính thức.
> Phase 0 chưa start code (đang ở docs). Khi tới Phase 1, copy các file này vào
> `apps/core-api/src/SaasCheckin.Domain/Identity/` rồi điều chỉnh theo thực tế.

## Tại sao preview này tồn tại

- **Test `ddd-aggregate` skill** — verify skill hoạt động với tech stack .NET 10 (skill gốc TypeScript, đã port sang C#).
- **Reference cho Phase 1 I-101** — khi implement, dev có 1 bản mẫu đầy đủ để đối chiếu.
- **Verify alignment với D13 (RBAC)** — User aggregate KHÔNG chứa role/permission; đó là của `Membership` aggregate riêng.

## Cấu trúc file

```
identity-user-aggregate/
├── Aggregates/
│   └── User.cs                    # Aggregate root — factory + domain methods + invariants
├── ValueObjects/
│   ├── UserId.cs                  # Strongly-typed GUID
│   ├── Email.cs                   # RFC 5322 + lowercase (match CITEXT DB)
│   └── FullName.cs                # Trim + collapse whitespace + max 200
├── Repositories/
│   └── IUserRepository.cs         # Interface only — implementation ở EF Core layer
├── Events/
│   ├── UserRegistered.cs          # In-process domain event
│   ├── UserEmailVerified.cs       # In-process
│   └── UserLockedOut.cs           # In-process
├── tests/
│   └── UserTests.cs               # xUnit + FluentAssertions + Moq — 9 test cases
├── IdentityModule.cs              # Bounded-context registration (DI)
└── README.md                      # File này
```

## Mapping với database schema

| Field DB (`users`) | Domain | Trong User.cs |
|---|---|---|
| `id` | `UserId` (VO) | `Id` (inherited) |
| `email` CITEXT UNIQUE | `Email` (VO) | `Email` |
| `email_verified_at` | `DateTimeOffset?` | `EmailVerifiedAt` |
| `full_name` VARCHAR(200) | `FullName` (VO) | `FullName` |
| `password_hash` TEXT NULL | `string?` | `PasswordHash` |
| `avatar_url` TEXT | `string?` | `AvatarUrl` |
| `locale` VARCHAR(10) | `string?` | `Locale` |
| `last_login_at` | `DateTimeOffset?` | `LastLoginAt` |
| `locked_until` | `DateTimeOffset?` | `LockedUntil` |
| `created_at` / `updated_at` | `DateTimeOffset` | `CreatedAt` / `UpdatedAt` |
| — | — | `FailedLoginCount` (computed, không lưu DB) |

## Tích hợp với D13 (RBAC hybrid)

- User aggregate **KHÔNG chứa role** — vai trò lưu ở `Membership` aggregate riêng (qua `Membership.UserId`).
- Permission key liên quan: `members:read`, `members:invite`, `members:update:role`, `members:revoke`, `members:transfer-ownership`. Khai báo ở `Identity/Authorization/Permissions.cs` (xem ADR-0015 §1).
- `RolePermissionMap` ở `Identity/Authorization/RolePermissionMap.cs` map role → permissions[]; BFF resolve ở JWT issue-time.

## Tích hợp với D1 (RLS tenancy)

- `users` là bảng **global**, KHÔNG có `tenant_id`, KHÔNG RLS (xem `database-schema.md` § 4.1).
- EF Core mapping: `modelBuilder.Entity<User>().ToTable("users")` không cần RLS policy.
- Tenant context đến qua `Membership` — query user trong tenant đi qua `IMembershipRepository.FindUsersInTenantAsync(tenantId)`, KHÔNG trực tiếp `IUserRepository` (tránh leak giữa tenant).

## Tích hợp với D2 (JWT auth)

- `User.Register` → publish `UserRegistered` → in-process handler trigger `SignInUser` use case → return JWT.
- `User.RecordSuccessfulLogin` → update `last_login_at`, reset failed count.
- `User.RecordFailedLogin` (≥ 5) → publish `UserLockedOut` → revoke refresh token qua Redis (`bl:{jti}`).

## Còn thiếu (Phase 1 I-101 sẽ làm)

- [ ] `Organization` aggregate + `Membership` aggregate (cùng file vì là 1 bounded context)
- [ ] `IPasswordHasher` interface (BCrypt, cost 12) — đã reference trong `User.Register` signature
- [ ] `IUserAppService` + `RegisterUserCommand` handler (Application layer)
- [ ] `EfUserRepository` implementation
- [ ] `IdentityModule.Register` body (DI bindings)
- [ ] `UserConfiguration` (EF Core fluent mapping)
- [ ] `RegisterUserRequest` DTO + OpenAPI annotation
- [ ] Integration test với Testcontainers Postgres (xem I-105)
- [ ] NetArchTest: `Identity.Domain` không depend `Identity.Application` hay `Identity.EntityFrameworkCore`

## Out of scope (Phase 2+)

- OAuth/SSO login (`password_hash` null)
- Multi-email per user (currently 1 email)
- Email change flow (revoke old + verify new)
- Phone number verification
