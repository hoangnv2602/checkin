# 0004. Authentication: custom JWT + refresh rotation

- **Status:** Accepted (D2)
- **Date:** 2026-06-04

## Context

Nền tảng cần một flow auth duy nhất hoạt động cho:
- **Next.js web** (cookie + RSC)
- **Flutter mobile** (offline-capable, secure storage, re-entry bằng biometric)
- **Internal NestJS ↔ .NET Core 10** (mTLS + service JWT)

Một library như NextAuth xử lý case web tốt nhưng sẽ tách rời khỏi flow mobile (shape token khác, refresh semantic khác).

## Decision

Implement **custom JWT** auth trong NestJS (`api-gateway`). .NET Core 10 trust cùng token.

- **Access token:** JWT ký bằng **RS256**, TTL 15 phút, claims: `sub` (userId), `orgId`, `role`, `permissions[]`, `jti`.
- **Refresh token:** chuỗi opaque 256-bit ngẫu nhiên, lưu Redis ở `rt:{tokenId}` với TTL 30 ngày. Xoay mỗi lần dùng; token cũ bị vô hiệu ngay.
- **Lưu trữ:**
  - Web: access trong RSC closure (không bao giờ tới client), refresh trong cookie httpOnly + Secure + SameSite=Lax.
  - Mobile: access trong memory (state `AuthBloc` / `SessionCubit`), refresh trong `flutter_secure_storage`.
- **Library:**
  - NestJS: `@nestjs/jwt` + `jose` để verify
  - .NET Core 10: `Microsoft.IdentityModel.JsonWebTokens` (sign + verify, cùng keypair)
    ```csharp
    // SaasCheckin.HttpApi.Host/Program.cs
    services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(opts =>
        {
            opts.RequireHttpsMetadata = true;
            opts.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = configuration["Jwt:Issuer"],
                ValidateAudience = true,
                ValidAudience = configuration["Jwt:Audience"],
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new RsaSecurityKey(rsaPublicKey),
                ClockSkew = TimeSpan.FromSeconds(60),
            };
        });
    ```
- **Keypair:** RS256 key sinh ở lần deploy đầu, lưu ở `/etc/api-gateway/jwt/`, xoay mỗi 6 tháng. Public key expose ở `GET /v1/.well-known/jwks.json` cho mobile verify offline.
- **Biometric trên mobile** bảo vệ re-entry app; token không bị bind với biometric.

## Consequences

### Positive
- Một contract token duy nhất xuyên web + mobile + gRPC.
- Web giữ RSC-first; không có xử lý token phía client.
- Mobile có thể verify token offline (cached JWKS) cho bước QR-verify.
- Refresh rotation giới hạn damage khi refresh token bị lộ.

### Negative
- Nhiều code maintain hơn một library.
- Refresh rotation yêu cầu Redis phải chạy — có thể suy giảm một phần (xem dưới).
- Không có UI liệt kê session built-in; phải tự build.

### Neutral
- Logout = vô hiệu cả access (blacklist `bl:{jti}` đến khi exp) và refresh (xóa khỏi Redis).
- Redis down → reject mọi auth request (fail-closed). Chấp nhận cho MVP; revisit nếu user khiếu nại.

## Alternatives considered

- **NextAuth v5** — best-in-class cho web nhưng mobile mismatch. Thêm hệ auth thứ hai phải đồng bộ.
- **Session-based chỉ với cookie** — phá mobile + gRPC.
- **PASETO thay JWT** — mặc định an toàn hơn, nhưng ecosystem (lib mobile, tool) nhỏ hơn. Hoãn sau MVP.

## Security checklist

- [ ] RS256 (không HS256 — secret lộ = mọi token đều forge được)
- [ ] Keypair trong env, không trong code
- [ ] Endpoint JWKS public nhưng có rate limit
- [ ] Mọi cookie `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] CSRF token trên route web thay đổi state (mobile bypass CSRF qua custom header)
- [ ] Khóa account sau 5 lần login fail trong 15 phút
- [ ] Audit log mọi event auth (login, refresh, logout, đổi password)
