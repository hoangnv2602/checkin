# 0015. RBAC: hybrid permission model (keys cứng, roles động)

- **Status:** Accepted (D13)
- **Date:** 2026-06-05
- **Deciders:** @team/tech-leads
- **Related:** [D1](./0003-tenancy-row-level-rls.md) (tenancy), [D2](./0004-auth-custom-jwt.md) (JWT có `permissions[]` claim), [D12](./0014-checkin-admin-app.md) (checkin-admin tách audience), [D13 in decisions.md](../decisions.md)

## Context

Hệ thống cần action-level authorization cho **2 audience** (tenant + platform owner) với **6 bounded context** nghiệp vụ + 1 context cross-tenant (PlatformOperations). Mỗi use case (.NET command/query) cần biết "user này có được gọi action này trong tenant này không" — và check phải:

1. **Type-safe** — typo permission phải fail compile-time, không phải runtime ở production.
2. **Security-reviewable** — mỗi permission là 1 code review riêng, không ai có thể grant nhầm `tenant:suspend` cho staff qua UI.
3. **Tenant-scoped** — RLS đã chốt data isolation ở D1; action-level check cần song song, không duplicate.
4. **Có thể mở rộng** — Phase 2+ có thể cần cho phép tenant tự tạo custom role, không phải deploy code.

### Hiện trạng đã chốt ở ADR trước

| Chỗ | Nội dung |
|---|---|
| `0004-auth-custom-jwt.md:19` | JWT claim có `permissions[]` ngoài `role` |
| `database-schema.md:39` | ENUM `membership_role` cứng: `('owner','admin','organizer','staff','viewer')` |
| `04-bounded-contexts.md:124` | `IPermissionChecker` interface trong `Shared.Application.Contracts/` |
| `phase-1-identity.md:22` (I-102) | `RolesGuard` (trước đây check `role` claim trực tiếp — đã sửa 2026-06-05) |
| `00-overview.md:18` | 5 role: Owner / Admin / Organizer / Staff / Viewer |

→ Project đã lean về hybrid mà chưa ai viết ADR chốt catalog permission key + mapping role → permissions.

### Inconsistency đã fix (2026-06-05)

- `00-overview.md` + `phase-1-identity.md` I-102 dùng 4 role (Owner/Organizer/Staff/Gate) — đã chuẩn hoá thành 5 role khớp với ENUM trong `database-schema.md`.
- `Gate` là khái niệm vật lý (`venues.gates`), không phải role. Kiosk-only mode là **per-user setting** trên Staff, không phải role riêng.

## Decision

Áp dụng **hybrid permission model**:

- **Permission keys** → **hard-coded constants** trong code, compile-time check.
- **Role → permissions mapping** → **static dictionary** 1 nguồn truth, dùng ở JWT issue-time để resolve `permissions[]` claim.
- **Default roles** → 5 role seed qua migration (Owner, Admin, Organizer, Staff, Viewer), không cho phép xoá role hệ thống.
- **Schema** → chuyển `memberships.role` từ **ENUM** sang **VARCHAR(40)** trong migration đầu Phase 1 (trước khi có production data). Lý do: mở đường cho Phase 2+ custom role per tenant mà không cần `ALTER TYPE`.
- **BFF NestJS** → **chỉ làm authn** (`JwtAuthGuard` verify JWT, set `req.user.permissions[]` từ claim). **KHÔNG có `PermissionsGuard`** — toàn bộ authorization check ở .NET `PermissionBehavior` (xem Alt D phân tích vì sao 3 lớp backend bị loại).
- **.NET MediatR `PermissionBehavior`** → **AUTHORITATIVE authz layer duy nhất**, mọi command/query phải implement `IRequirePermission`.
- **Defense in depth (đúng nghĩa)** → 2 lớp độc lập, khác concern: .NET authz (action-level) + DB RLS (data-level). Không phải check cùng 1 thứ 2 lần.
- **Custom roles per tenant** → **defer sang Phase 2+** (opt-in enterprise feature). Schema đã sẵn sàng vì `role` là VARCHAR.

### 1. Permission keys catalog

> Nguồn: `apps/core-api/shared/Shared.Domain/Identity/Authorization/Permissions.cs`
> Quy ước đặt tên: `<resource>:<action>` hoặc `<resource>:<action>:<qualifier>`. Viết thường, kebab-case cho qualifier.
> Mọi key là `public const string` trong nested static class — typo là compile error.

```csharp
public static class Permissions
{
    // === Organization & Billing ===
    public static class Org
    {
        public const string Read          = "org:read";
        public const string Update        = "org:update";
        public const string Delete        = "org:delete";             // reserved; not exposed in MVP
    }
    public static class Billing
    {
        public const string Read          = "org:billing:read";
        public const string Update        = "org:billing:update";     // change plan, payment method
        public const string Cancel        = "org:billing:cancel";     // cancel subscription (Owner only)
        public const string Refund        = "orders:refund";          // issue refund for an order
    }

    // === Members (membership management) ===
    public static class Members
    {
        public const string Read          = "members:read";
        public const string Invite        = "members:invite";
        public const string UpdateRole    = "members:update:role";
        public const string Revoke        = "members:revoke";
        public const string TransferOwner = "members:transfer-ownership"; // Owner only, single-use/session
    }

    // === Venues & Gates (physical location) ===
    public static class Venues
    {
        public const string Read          = "venues:read";
        public const string Create        = "venues:create";
        public const string Update        = "venues:update";
        public const string Delete        = "venues:delete";
    }
    public static class Gates
    {
        public const string Read          = "gates:read";
        public const string Create        = "gates:create";
        public const string Update        = "gates:update";
        public const string Delete        = "gates:delete";
    }

    // === Event Management ===
    public static class Events
    {
        public const string Read          = "events:read";
        public const string Create        = "events:create";
        public const string Update        = "events:update";
        public const string Delete        = "events:delete";
        public const string Publish       = "events:publish";
        public const string Cancel        = "events:cancel";
        public const string Duplicate     = "events:duplicate";
    }

    // === Ticketing ===
    public static class TicketTypes
    {
        public const string Read          = "ticket-types:read";
        public const string Create        = "ticket-types:create";
        public const string Update        = "ticket-types:update";
        public const string Delete        = "ticket-types:delete";
    }
    public static class DiscountCodes
    {
        public const string Read          = "discount-codes:read";
        public const string Create        = "discount-codes:create";
        public const string Update        = "discount-codes:update";
        public const string Delete        = "discount-codes:delete";
    }

    // === Orders & Registrations ===
    public static class Orders
    {
        public const string Read          = "orders:read";
    }
    public static class Registrations
    {
        public const string Read          = "registrations:read";
        public const string Revoke        = "registrations:revoke";
        public const string ResendQr      = "registrations:resend-qr";
    }

    // === Check-in (core) ===
    public static class Checkin
    {
        public const string Scan          = "checkin:scan";           // scan QR
        public const string Manual        = "checkin:manual";         // manual check-in (with reason)
        public const string Override      = "checkin:override";       // manual override (no reason, audit)
        public const string Undo          = "checkin:undo";           // undo a successful check-in
    }

    // === Reports & Audit ===
    public static class Reports
    {
        public const string Read          = "reports:read";
        public const string Export        = "reports:export";
    }
    public static class Audit
    {
        public const string Read          = "audit:read";             // tenant-scoped; cross-tenant is platform audit
    }

    // === Webhooks & API keys (Phase 4+) ===
    public static class Webhooks
    {
        public const string Read          = "webhooks:read";
        public const string Create        = "webhooks:create";
        public const string Update        = "webhooks:update";
        public const string Delete        = "webhooks:delete";
    }
    public static class ApiKeys
    {
        public const string Read          = "api-keys:read";
        public const string Create        = "api-keys:create";
        public const string Revoke        = "api-keys:revoke";
    }
}
```

**Tổng:** 50 keys. Tập đóng — thêm key mới = code change + migration nếu có data cũ cần map.

### 2. Default roles + permission set

> Nguồn: `apps/core-api/shared/Shared.Domain/Identity/Authorization/RolePermissionMap.cs`
> Đây là **1 nguồn truth duy nhất** cho mapping. JWT issue-time resolve `permissions[]` từ map này.

```csharp
public static class Roles
{
    public const string Owner    = "owner";
    public const string Admin    = "admin";
    public const string Organizer = "organizer";
    public const string Staff    = "staff";
    public const string Viewer   = "viewer";
}

public static class RolePermissionMap
{
    public static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> Map = new Dictionary<string, IReadOnlySet<string>>
    {
        // Owner: ALL permissions, bao gồm cả 3 key "Owner-only" ở dưới
        [Roles.Owner] = AllPermissionKeys,

        // Admin: mọi thứ trừ 3 key cần Owner duy nhất
        [Roles.Admin] = All.Except(new[] {
            Permissions.Billing.Cancel,        // cancel subscription
            Permissions.Members.TransferOwner, // transfer ownership
            Permissions.Audit.Read,            // xem full audit log
        }),

        // Organizer: vận hành event end-to-end, trừ billing + members + audit
        [Roles.Organizer] = new HashSet<string> {
            Permissions.Org.Read,
            Permissions.Venues.Read, Permissions.Venues.Create, Permissions.Venues.Update, Permissions.Venues.Delete,
            Permissions.Gates.Read,  Permissions.Gates.Create,  Permissions.Gates.Update,  Permissions.Gates.Delete,
            Permissions.Events.Read, Permissions.Events.Create, Permissions.Events.Update, Permissions.Events.Delete,
            Permissions.Events.Publish, Permissions.Events.Cancel, Permissions.Events.Duplicate,
            Permissions.TicketTypes.Read, Permissions.TicketTypes.Create, Permissions.TicketTypes.Update, Permissions.TicketTypes.Delete,
            Permissions.DiscountCodes.Read, Permissions.DiscountCodes.Create, Permissions.DiscountCodes.Update, Permissions.DiscountCodes.Delete,
            Permissions.Orders.Read,
            Permissions.Registrations.Read, Permissions.Registrations.Revoke, Permissions.Registrations.ResendQr,
            Permissions.Checkin.Scan, Permissions.Checkin.Manual, Permissions.Checkin.Override, Permissions.Checkin.Undo,
            Permissions.Reports.Read, Permissions.Reports.Export,
            Permissions.Members.Read,    // xem member, không invite/update/revoke
        },

        // Staff: vận hành event được giao (assign qua membership scope — Phase 2)
        [Roles.Staff] = new HashSet<string> {
            Permissions.Org.Read,
            Permissions.Venues.Read, Permissions.Gates.Read,
            Permissions.Events.Read,
            Permissions.TicketTypes.Read,
            Permissions.Orders.Read,
            Permissions.Registrations.Read,
            Permissions.Checkin.Scan, Permissions.Checkin.Manual,  // kiosk mode = tắt Manual qua user setting
            Permissions.Reports.Read,
        },

        // Viewer: read-only across the org
        [Roles.Viewer] = new HashSet<string> {
            Permissions.Org.Read,
            Permissions.Venues.Read, Permissions.Gates.Read,
            Permissions.Events.Read,
            Permissions.TicketTypes.Read,
            Permissions.DiscountCodes.Read,
            Permissions.Orders.Read,
            Permissions.Registrations.Read,
            Permissions.Reports.Read,
            Permissions.Members.Read,
        },
    };
}
```

> **Phase 1 scope:** 5 role trên. Trong `RolePermissionMap` chỉ expose những key Phase 1 dùng (`Org`, `Members`, `Events`, `Checkin`, `Reports`, `Audit`). Các key `Billing`, `Venues`, `Gates`, `TicketTypes`, `DiscountCodes`, `Orders`, `Registrations`, `Webhooks`, `ApiKeys` được thêm vào map theo từng phase (2 → 4). **Catalog đầy đủ 50 key liệt kê ở trên để định hướng** — implementation Phase 1 chỉ include subset cần thiết.

### 3. Schema migration (Phase 1)

> Thực hiện trong migration đầu của Phase 1 (cùng migration tạo `organizations`, `users`, `memberships`).

```sql
-- Bước 1: chuyển ENUM sang VARCHAR
-- (Hiện tại chưa có data nên an toàn; nếu đã có data phải thêm USING clause)
ALTER TABLE memberships ALTER COLUMN role TYPE VARCHAR(40) USING role::TEXT;
DROP TYPE IF EXISTS membership_role;

-- Bước 2: CHECK constraint làm "schema-level safety net"
ALTER TABLE memberships
    ADD CONSTRAINT chk_membership_role_valid
    CHECK (role IN ('owner','admin','organizer','staff','viewer'));

-- Bước 3: app-layer validate lần cuối (MediatR pipeline behavior)
--   Tránh thêm key mới phải ALTER TABLE. Key mới = 1 PR.
```

> **Tại sao không giữ ENUM:**
> 1. ENUM Postgres rất khó evolve — thêm value cần `ALTER TYPE ADD VALUE` (chỉ support trong 1 transaction riêng, không trong migration có transaction khác).
> 2. Phase 2 muốn cho tenant tạo custom role → sẽ phải `ALTER TYPE` hàng loạt hoặc tạo cột mới. VARCHAR từ đầu tránh được.
> 3. App-layer validate (FluentValidation) đủ nhanh, catch typo ở `CreateMembershipCommand` handler.

### 4. JWT claim `permissions[]` (resolve ở issue-time)

> Liên quan: ADR-0004 § Access token. Claim hiện đã có; ADR này chốt **cách resolve**.

**Flow:**

```
1. User login → NestJS auth controller gọi core-api gRPC `SignInUser(userId)`
2. core-api load membership + role
3. Resolve permissions: `RolePermissionMap.Map[role]`
4. Sign JWT với claims: { sub, orgId, role, permissions: [...], jti, exp }
5. Trả cho BFF → set cookie / trả cho mobile
```

**Caching:** permissions[] resolve 1 lần ở login. Access token 15 phút — nếu role đổi trong lúc token còn hạn, thay đổi chỉ apply sau khi refresh. Acceptable cho MVP (Phase 2 có thể thêm Redis pub/sub để revoke sớm).

**Backward compat với token cũ (pre-D13):** nếu JWT cũ không có `permissions[]` claim, .NET `PermissionBehavior` fallback resolve qua `RolePermissionMap.Map[user.role]` để derive permissions[] runtime — defensive coding, không tin tưởng claim 100%. Sau khi rollout D13 xong (≤ 30 ngày refresh rotation), fallback này có thể gỡ.

### 5. BFF guard design — chỉ authn, không authz

> **Nguyên tắc:** NestJS (api-gateway) là I/O layer — verify JWT, route request, không kiểm tra permission. Permission check là domain rule → thuộc về core-api (xem CLAUDE.md rule #1).

```typescript
// apps/api-gateway/src/modules/_shared/auth/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        // Verify RS256, kiểm tra exp, set req.user = { sub, orgId, role, permissions[] }
        // Nếu fail → 401
    }
}

// apps/api-gateway/src/modules/checkin-admin/admin-auth.guard.ts
@Injectable()
export class PlatformAdminAuthGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        const { user } = ctx.switchToHttp().getRequest();
        // Check: aud === 'checkin-admin' && mfa === true
        //        && role ∈ {platform_owner, platform_support, platform_engineer}
        // Nếu fail → 403 (không phải 401 — user đã login, chỉ thiếu privilege)
    }
}

// Sử dụng — KHÔNG có PermissionsGuard, KHÔNG có @RequirePermission
@Controller('v1/events')
@UseGuards(JwtAuthGuard)                  // chỉ authn: verify token
export class EventsController {
    @Post()
    create(@Body() dto: CreateEventDto) {
        // Forward gRPC tới core-api. .NET PermissionBehavior là authoritative check.
        // Nếu user thiếu permission → core-api trả ForbiddenException → BFF map 403.
    }
}

@Controller('v1/admin')
@UseGuards(JwtAuthGuard, PlatformAdminAuthGuard)   // authn + audience separation
export class AdminController { ... }

// Pure-BFF route — không qua .NET, dùng guard riêng cho từng protocol
@Controller('v1/webhooks')
export class WebhooksController {
    @Post('stripe')
    @UseGuards(StripeSignatureGuard)        // verify Stripe webhook signature
    @UseGuards(VnpaySignatureGuard)         // verify VNPay IPN signature
    handleStripe(@Body() raw: RawBody) { ... }
}
```

**Phân chia trách nhiệm rõ ràng:**

| Layer | Authn | Authz | Lý do |
|---|---|---|---|
| **Frontend** | — | Ẩn nút (UX hint, không phải security) | Không trust client |
| **BFF NestJS** | ✅ Verify JWT, audience separation, IP allowlist, rate limit, webhook signature | **❌ KHÔNG check permission** | Authorization = domain rule → core-api |
| **Core API .NET** | Setup `ICurrentUser` từ JWT claim | ✅ **AUTHORITATIVE** — `PermissionBehavior` reject nếu thiếu permission | Source of truth duy nhất |
| **Postgres RLS** | — | ✅ Data isolation (row-level) | Defense cuối cùng, tách biệt concern |

**Tại sao KHÔNG có `PermissionsGuard` ở NestJS:**

1. **Duplicate logic = drift risk.** NestJS check `permissions[]` claim + .NET check `permissions[]` claim → 2 chỗ phải đồng bộ, 1 quên update là security hole.
2. **CLAUDE.md rule #1**: business logic ở core-api, BFF chỉ I/O. Authorization là business logic.
3. **gRPC đủ nhanh.** Mỗi unauthorized request tốn thêm < 1ms gRPC internal — không đáng để maintain 1 lớp code.
4. **Pure-BFF routes** (WebSocket, webhook, file upload) có guard riêng theo protocol (signature verification, scope claim check) — không phải `permissions[]` generic.

**Tại sao `JwtAuthGuard` vẫn ở BFF** (không phải ở .NET):
- Một số route KHÔNG qua .NET (webhook, health, JWKS endpoint, WebSocket connect).
- Fast-fail 401 ngay tại edge trước khi tốn gRPC.
- Audience separation (`/v1/admin/*` cần `aud: 'checkin-admin'`) là route-level concern, không phải use case concern.

### 6. MediatR pipeline behavior (.NET) — AUTHORITATIVE LAYER DUY NHẤT

```csharp
// apps/core-api/shared/Shared.Application/Behaviors/PermissionBehavior.cs
public class PermissionBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>, IRequirePermission
{
    private readonly ICurrentUser _currentUser;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var userPerms = _currentUser.Permissions; // resolve từ JWT claim, cache per request
        if (!request.RequiredPermissions.All(userPerms.Contains))
            throw new ForbiddenException($"Missing permission: {string.Join(",", request.RequiredPermissions)}");
        return await next();
    }
}

// Trên command/query:
public record PublishEventCommand(Guid EventId) : IRequest<PublishEventResult>, IRequirePermission
{
    public IReadOnlyList<string> RequiredPermissions => new[] { Permissions.Events.Publish };
}
```

**Defense in depth:**
1. .NET `PermissionBehavior` reject request ở application layer → **authoritative** check.
2. RLS ở DB enforce tenant isolation → nếu ai đó bypass application layer, chỉ truy cập được row trong tenant mình.
3. (Optional) BFF NestJS `JwtAuthGuard` fast-fail 401 cho request không có/không hợp lệ token → tránh tốn gRPC.

### 7. Frontend helper

```ts
// apps/web/src/lib/permissions.ts  (đã có sẵn skeleton ở I-011, nay chốt contract)
export const PERMISSIONS = {
    Events: {
        Read:      'events:read',
        Create:    'events:create',
        Publish:   'events:publish',
        // ... mirror server-side Permissions class
    },
    // ... nhóm khác
} as const;

// Hook:
export function useHasPermission(...required: string[]): boolean {
    const session = useSession(); // RSC-safe
    const userPerms = new Set(session.permissions ?? []);
    return required.every(p => userPerms.has(p));
}

// Sử dụng:
const canPublish = useHasPermission(PERMISSIONS.Events.Publish);
{canPublish && <Button>Publish</Button>}
```

> Client-side check chỉ để UX (ẩn nút user không dùng được). Authorization thật ở BFF + core-api.

### 8. Mobile (Flutter)

```dart
// apps/mobile/lib/features/_shared/auth/permissions.dart
class Permissions {
  static const checkinScan = 'checkin:scan';
  static const checkinManual = 'checkin:manual';
  // ... mirror server
}

// Bloc state lưu permissions[] resolve từ JWT
class SessionState {
  final Set<String> permissions;
  bool has(String p) => permissions.contains(p);
}

// UI guard:
if (context.read<SessionCubit>().state.has(Permissions.checkinManual)) {
  // show "Manual check-in" button
}
```

## Consequences

### Positive

- **Type-safe end-to-end.** Thêm permission mới = thêm 1 const string, IDE autocomplete, typo fail compile.
- **Security-reviewable.** Mỗi `Permissions.*` constant là 1 dòng code, mỗi `RolePermissionMap` entry là 1 dòng — git blame rõ ràng ai thêm key X, ai gán key X cho role Y.
- **Single source of truth ở authorization.** .NET `PermissionBehavior` là nơi DUY NHẤT check permission. Audit chỉ cần review 1 chỗ, không lo drift.
- **Defense in depth (đúng nghĩa).** 2 lớp độc lập, khác concern: .NET authz (action-level) + DB RLS (data-level). Mất 1 lớp vẫn an toàn — 2 lớp này bảo vệ 2 thứ khác nhau, không phải check cùng 1 thứ.
- **UI render đơn giản.** Role claim cho menu coarse-grained, permissions[] cho button fine-grained.
- **Schema không khóa Phase 2.** `VARCHAR(40)` + CHECK constraint cho phép custom role mà không cần `ALTER TYPE`.
- **BFF đơn giản.** Không có `PermissionsGuard` decorator, không có `@RequirePermission` ở mỗi route — giảm boilerplate, dễ onboard dev mới.

### Negative

- **Thêm permission = code change + redeploy ở cả 2 phía** (NestJS không check nhưng vẫn phải update `Permissions` mirror nếu dùng cho UI button hide). Chấp nhận vì 1) thêm permission thường đi kèm code mới, 2) Phase 2+ có thể cho tenant tự compose từ tập permission cứng.
- **Role đổi trong lúc access token còn hạn → không apply ngay.** Tối đa 15 phút. Acceptable MVP, Phase 2 thêm Redis pub/sub revoke.
- **5 role cố định không cover mọi use case enterprise.** Phase 2 mở rộng.
- **Catalog 50 key phải maintain.** Tăng dần theo phase, không phải tạo tất cả 1 lần.
- **Mọi request đều hit gRPC**, kể cả request sẽ bị .NET reject. Internal gRPC < 1ms, chấp nhận được.

### Neutral

- **Phase 1 chỉ implement subset permission key** (Org, Members, Events cơ bản, Checkin, Reports, Audit). Các key khác thêm theo phase tương ứng.
- **Custom role per tenant = feature Phase 2.** Schema đã sẵn sàng, không tốn thêm migration lớn.
- **Permission key string dùng chung cho 3 layer** (NestJS guard, .NET behavior, Flutter UI). 3 nơi phải update khi thêm key — chấp nhận được vì key hiếm khi thêm (vài lần/năm).

## Alternatives considered

### Alt A — Fully dynamic (Auth0/Casbin style)

Mọi permission lưu DB, role là row trong `roles` table, user-role là join table. Platform owner (hoặc tenant) tạo role từ UI.

- **Bị loại** vì: 1) số action bounded (~50) → dynamic là overkill, 2) security-critical action phải code review, không ai muốn audit qua UI click, 3) type safety mất, 4) DB corruption = lộ permission. Hybrid giữ được ưu điểm dynamic (custom role Phase 2) mà không phải trả cost ở MVP.

### Alt B — ABAC (OPA / Cedar)

Decision dựa trên attribute runtime (giờ trong ngày, IP, geofence, resource owner).

- **Bị loại** vì: 1) overkill cho check-in SaaS, 2) ops cost cao (deploy OPA sidecar, rego policy file), 3) staff cần scan ngay cả khi mạng chậm — ABAC eval thường cần central PDP. Giữ cho Phase 8+ nếu cần compliance SOC 2.

### Alt C — Role-only (no `permissions[]`)

NestJS guard check `role` claim trực tiếp, không qua `permissions[]`. JWT chỉ có `role`.

- **Bị loại** vì: 1) mất fine-grained check (Organizer có thể publish, nhưng Staff cũng có thể update event — cần 2 permission khác nhau), 2) Phase 2+ custom role sẽ cần resolve permission anyway, làm sau tốn refactor, 3) UI check `role` cho button dẫn tới role explosion (Organizer-ReadOnly, Organizer-PlusBilling, ...). ADR-0004 đã chốt có `permissions[]` claim — quay lại role-only là revert decision.

### Alt D — 3 lớp backend (NestJS guard + .NET behavior + RLS) — phiên bản trước

NestJS có `PermissionsGuard` check `permissions[]` ở edge, .NET check lại, RLS chốt. **Defense in depth** cùng 1 concern 3 lần.

- **Bị loại** vì: 1) duplicate logic 2 chỗ check cùng claim → drift risk, 2) mỗi unauthorized request vẫn tốn ~1ms gRPC dù BFF đã reject, 3) tăng attack surface (1 lớp guard BFF có bug = lộ), 4) security review phải audit 2 chỗ thay vì 1, 5) vi phạm CLAUDE.md rule #1 (BFF chỉ I/O). Tuy nhiên, nếu sau này thấy cần fast-reject ở edge cho DoS protection, có thể add lại `PermissionsGuard` opt-in cho route cụ thể — không khóa future.

## Khi nào revisit

| Trigger | Hành động |
|---|---|
| Tenant đầu tiên yêu cầu custom role (enterprise deal) | Bật Phase 2 plan: thêm `roles` table + `role_permissions` join + `RolePermissionResolver` ưu tiên custom role. Schema đã VARCHAR(40) — không cần migration lớn. |
| Catalog permission vượt 100 key | Cân nhắc gộp theo resource group (`events:*` → grant cả nhóm), hoặc dùng ABAC cho resource-level check. |
| Cần compliance SOC 2 / ISO 27001 | Bổ sung ABAC attribute (IP allowlist, time-of-day, MFA level) bằng Cedar sidecar; giữ RBAC làm primary. |
| Staff mobile phàn nàn "phải login lại khi đổi ca" | Implement Redis pub/sub revoke access token khi role đổi; giảm TTL tạm thời 15' → 5' cho user sensitive. |
| Phát hiện 1 role phình to > 40 permission key | Tách thành 2 role (vd tách `Organizer-Finance` có billing, `Organizer-Operations` không có). |

## Migration plan

### Phase 0 (this ADR)
- ✅ Tạo ADR-0015 + reference trong `decisions.md` (D13).
- ✅ Sửa inconsistency persona (5 role thay vì 4) — đã làm 2026-06-05.

### Phase 1 (Identity context)
- Migration đầu Phase 1: drop ENUM `membership_role` → VARCHAR(40) + CHECK constraint.
- Tạo `shared/Shared.Domain/Identity/Authorization/Permissions.cs` + `Roles.cs` + `RolePermissionMap.cs` (subset Phase 1).
- Implement `ICurrentUser.Permissions` resolve từ JWT claim trong request scope.
- Implement MediatR `PermissionBehavior` ở `Shared.Application/Behaviors/` — **AUTHORITATIVE authz layer duy nhất**.
- Implement `IPermissionChecker` (đã có interface ở `04-bounded-contexts.md`) gọi `RolePermissionMap` — dùng cho code path không phải command/query (vd background job check trước khi ghi, hoặc EF interceptor filter pre-save).
- **BFF NestJS KHÔNG tạo `PermissionsGuard` / `@RequirePermission` decorator.** Chỉ implement `JwtAuthGuard` (verify JWT, set `req.user.permissions[]` từ claim). Mọi controller chỉ attach `[JwtAuthGuard]` — để .NET `PermissionBehavior` lo phần authz. Pure-BFF route (webhook, WS) dùng guard riêng theo protocol, implement trong issue tương ứng (I-3xx+).
- Seed migration: insert 1 Owner membership cho user đầu tiên của mỗi tenant mới.

### Phase 2+ (per bounded context)
- Từng context implement command/query, mỗi cái thêm 1+ permission key vào `Permissions.cs` + 1 entry trong `RolePermissionMap` cho role thích hợp.

### Phase 2+ opt-in: custom role per tenant
- Thêm `roles` table (id, tenant_id, name, is_system) + `role_permissions` (role_id, permission_key) + `memberships.role` đổi từ VARCHAR FK thành FK tới `roles.id`.
- `RolePermissionMap` ở code trở thành "default system role mapping" — `RoleResolver` ưu tiên custom role của tenant trước.

## References

- [`docs/00-overview.md`](../00-overview.md) § User persona — 5 role set chuẩn
- [`docs/04-bounded-contexts.md`](../04-bounded-contexts.md) § Identity & Tenancy — `IPermissionChecker` ở shared kernel
- [`docs/adr/0004-auth-custom-jwt.md`](./0004-auth-custom-jwt.md) — JWT claim `permissions[]`
- [`docs/adr/0003-tenancy-row-level-rls.md`](./0003-tenancy-row-level-rls.md) — D1, data-level isolation song song
- [`docs/adr/0014-checkin-admin-app.md`](./0014-checkin-admin-app.md) — D12, platform audience tách riêng (D13 chỉ lo tenant RBAC; platform RBAC đã chốt ở D12 với 3 role `platform_owner`/`platform_support`/`platform_engineer`)
- [`docs/database-schema.md`](../database-schema.md) § 4.2 `memberships` — migration target
- [`docs/06-api.md`](../06-api.md) § Luồng auth — JWT contract
- [`docs/07-frontend.md`](../07-frontend.md) § permissions.ts — frontend helper contract
- [`docs/issues/phase-1-identity.md`](../issues/phase-1-identity.md) — I-101, I-102 implementation tasks
- [`docs/11-risks.md`](../11-risks.md) § Risk #23 — dev nhầm route checkin-admin/tenant (CDE boundary)
- Casbin documentation — reference pattern cho hybrid RBAC
- Auth0 "Role-Based Access Control" — best practice tenant isolation
