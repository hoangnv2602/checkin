using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Identity.Authorization;
using SaasCheckin.Shared.Domain;

namespace SaasCheckin.Domain.Identity;

/// <summary>
/// IdentityModule — bounded context registration.
/// Phase 0: chỉ register DI. Phase 1+ register IUserRepository, IPasswordHasher, etc.
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
    }
}
