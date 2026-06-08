// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/HostBuilderExtensions.cs
//
// Serilog wiring for the host. Kept separate from the IServiceCollection
// chain because it runs on the IHostBuilder (configured before the
// service provider exists).
using Serilog;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class HostBuilderExtensions
{
    /// <summary>
    /// Configure Serilog as the host logger. Reads sinks/levels from
    /// configuration (appsettings.json "Serilog" section) and always
    /// enriches with LogContext + writes to Console.
    /// </summary>
    public static WebApplicationBuilder UseSaasCheckinSerilog(this WebApplicationBuilder builder)
    {
        builder.Host.UseSerilog((ctx, lc) => lc
            .ReadFrom.Configuration(ctx.Configuration)
            .Enrich.FromLogContext()
            .WriteTo.Console());
        return builder;
    }
}
