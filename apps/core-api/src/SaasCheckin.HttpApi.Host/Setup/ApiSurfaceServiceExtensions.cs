// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/ApiSurfaceServiceExtensions.cs
//
// The three ways the host exposes its API:
//   1. OpenAPI document (D8) — generated at /openapi/v1.json
//   2. gRPC services         — bound at MapGrpcService<T>() in pipeline
//   3. REST controllers      — discovered via AddControllers()
//
// Endpoint mapping itself happens in ApplicationBuilderExtensions; this
// file only registers the surfaces with the DI / routing system.
using Microsoft.Extensions.DependencyInjection;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class ApiSurfaceServiceExtensions
{
    /// <summary>
    /// Register the three API surfaces: OpenAPI document, gRPC server,
    /// and ASP.NET controllers. The Scalar UI is added in the pipeline
    /// (dev-only) and gRPC service bindings are mapped in pipeline.
    /// </summary>
    public static IServiceCollection AddSaasCheckinApiSurface(this IServiceCollection services)
    {
        // OpenAPI (D8)
        services.AddOpenApi();

        // gRPC
        services.AddGrpc();

        // Controllers (REST endpoints — Phase 1 mirror gRPC for BFF/Playwright tests)
        services.AddControllers();

        return services;
    }
}
