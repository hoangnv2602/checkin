using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Application.PlatformOperations.Services;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Application.PlatformOperations;

/// <summary>
/// PlatformOperations application module (I-107, D12, ADR-0014).
/// Wires cross-cutting services cho platform admin auth:
///  - IRefreshTokenHasher (SHA-256) cho DB-backed sessions
///
/// Repositories (IPlatformUserRepository, IPlatformSessionRepository) registered
/// ở EntityFrameworkCore (cần DbContext) — same pattern as Identity.
/// </summary>
public static class PlatformApplicationModule
{
    public static IServiceCollection AddPlatformApplication(this IServiceCollection services)
    {
        services.AddSingleton<IRefreshTokenHasher, Sha256RefreshTokenHasher>();
        return services;
    }
}

public sealed class PlatformApplicationRegistration : IBoundedContextModule
{
    public string Name => "PlatformOperations.Application";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddPlatformApplication();
    }
}
