// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/PersistenceServiceExtensions.cs
//
// DbContext + Redis singletons. The two external dependencies the host
// cannot start without (when their connection strings are configured).
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Infrastructure.Extensions;
using StackExchange.Redis;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class PersistenceServiceExtensions
{
    /// <summary>
    /// Register the EF Core DbContext (with RLS interceptor) and the Redis
    /// connection multiplexer. Redis is registered only when the connection
    /// string is set so dev mode without Redis still boots.
    /// </summary>
    public static IServiceCollection AddSaasCheckinPersistence(
        this IServiceCollection services, IConfiguration configuration)
    {
        // DbContext + Identity repositories + RLS interceptor
        services.AddSaasCheckinDbContext(configuration);

        // Redis (JWT signing key cache + refresh tokens)
        var redisConn = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrEmpty(redisConn))
        {
            services.AddSingleton<IConnectionMultiplexer>(_ =>
                ConnectionMultiplexer.Connect(redisConn));
        }

        return services;
    }
}
