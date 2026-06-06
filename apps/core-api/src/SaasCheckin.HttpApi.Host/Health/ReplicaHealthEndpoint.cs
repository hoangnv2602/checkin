// apps/core-api/src/SaasCheckin.HttpApi.Host/Health/ReplicaHealthEndpoint.cs
// I-805 — Endpoint expose replica lag cho Grafana scrape.
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SaasCheckin.EntityFrameworkCore;

namespace SaasCheckin.HttpApi.Host.Health;

public static class ReplicaHealthEndpoint
{
    public static IEndpointRouteBuilder MapReplicaHealth(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/health/replica", async (IDbContextProvider provider, CancellationToken ct) =>
        {
            var available = await provider.IsReplicaAvailableAsync(ct);
            var lag = provider.ReplicaLag;
            return Results.Ok(new
            {
                available,
                lagSeconds = lag?.TotalSeconds,
                status = !available ? "fallback_primary" : (lag?.TotalSeconds > 5 ? "lagging" : "ok"),
            });
        });
        return endpoints;
    }
}
