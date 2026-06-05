using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Identity.Repositories;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Shared.Application.Contracts;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.Identity;

/// <summary>
/// Identity bounded-context module — registers DI bindings cho
/// User/Organization/Membership aggregates + JWT signing + password hasher.
///
/// Mọi registration nên go qua extension <c>AddIdentityModule()</c> trong
/// SaasCheckin.Application thay vì wire trực tiếp. Phase 1 cung cấp cả 2:
/// - <see cref="Register"/> ở đây: core Domain bindings (interfaces)
/// - <c>AddIdentityModule()</c> ở Application: application services + handlers
/// </summary>
public sealed class IdentityModule : IBoundedContextModule
{
    public string Name => "Identity";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // Cross-cutting
        services.AddSingleton<IClock, SystemClock>();

        // Password hashing (BCrypt cost 12)
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();

        // JWT signing service — singleton vì RSA key cached in Redis 24h
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        // Repositories — registered ở EntityFrameworkCore (cần DbContext).
        // Domain chỉ declare interface; impl thuộc infrastructure.
    }
}
