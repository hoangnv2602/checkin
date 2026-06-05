// File: IdentityModule.cs (root of bounded context)
// Đăng ký DI cho Identity context: repositories, services, value-object factories,
// permission keys (D13 RBAC).
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Identity.Authorization;   // Roles.cs, Permissions.cs (D13)
using SaasCheckin.Shared.Domain;                  // IBoundedContextModule

namespace SaasCheckin.Domain.Identity;

/// <summary>
/// Bounded context module cho Identity. Register ở SaasCheckin.HttpApi.Host/Program.cs
/// qua <c>app.AddBoundedContextModule&lt;IdentityModule&gt;();</c>.
/// </summary>
public sealed class IdentityModule : IBoundedContextModule
{
    public string Name => "Identity";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // TODO Phase 1 I-101:
        // services.AddScoped<IUserRepository, EfUserRepository>();
        // services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        // services.AddSingleton<IClock, SystemClock>();
        // services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();

        // Permission keys cho Identity context (D13):
        // - members:read, members:invite, members:update:role, members:revoke, members:transfer-ownership
        // Khai báo ở Permissions.cs (D13 §1); IdentityModule chỉ cần verify đã declare.
    }
}
