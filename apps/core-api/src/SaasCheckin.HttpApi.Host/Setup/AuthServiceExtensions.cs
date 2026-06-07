// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/AuthServiceExtensions.cs
//
// Authentication for REST controllers and the platform-admin endpoint
// filter. gRPC services use gRPC metadata, not this stack.
using Microsoft.Extensions.DependencyInjection;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class AuthServiceExtensions
{
    /// <summary>
    /// JWT bearer (for REST controllers / future SignalR) +
    /// Authorization pipeline + the I-107 PlatformAuthFilter (verifies
    /// aud=checkin-admin Bearer token before /v1/admin/* requests).
    /// </summary>
    public static IServiceCollection AddSaasCheckinAuth(this IServiceCollection services)
    {
        // I-107: Platform admin auth filter (verify aud=checkin-admin Bearer token)
        services.AddScoped<SaasCheckin.HttpApi.Host.Middleware.PlatformAuthFilter>();

        services.AddAuthentication("Bearer")
            .AddJwtBearer();
        services.AddAuthorization();
        return services;
    }
}
