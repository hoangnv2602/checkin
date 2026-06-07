// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/HealthCheckServiceExtensions.cs
//
// K8s-style health probes. The "ready" tag groups checks that gate
// traffic (Postgres + Redis) — distinct from "live" which only proves
// the process is running. Endpoint mapping lives in the pipeline.
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class HealthCheckServiceExtensions
{
    /// <summary>
    /// Register health checks (K8s convention):
    ///   - postgres : NpgSql ready check
    ///   - redis    : Redis ready check
    /// Both tagged "ready" so /health/ready gates traffic and /health/live
    /// only confirms the process is alive.
    /// </summary>
    public static IServiceCollection AddSaasCheckinHealthChecks(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHealthChecks()
            .AddNpgSql(
                connectionStringFactory: _ => configuration.GetConnectionString("Default")!,
                name: "postgres",
                tags: ["ready"])
            .AddRedis(
                redisConnectionString: configuration.GetConnectionString("Redis")!,
                name: "redis",
                tags: ["ready"]);
        return services;
    }
}
