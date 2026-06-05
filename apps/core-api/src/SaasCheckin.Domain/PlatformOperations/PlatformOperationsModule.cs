using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.PlatformOperations.Services;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Domain.PlatformOperations;

/// <summary>
/// PlatformOperations bounded-context module (D12, ADR-0014).
/// Register password hasher + TOTP verifier. Repositories registered ở EF.
/// </summary>
public sealed class PlatformOperationsModule : IBoundedContextModule
{
    public string Name => "PlatformOperations";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<ITotpCodeVerifier, TotpCodeVerifier>();
    }
}
