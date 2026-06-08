// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/ApplicationBuilderExtensions.cs
//
// The request pipeline, end-to-end, in the order components must run:
//   1. CurrentTenantMiddleware    — set ICurrentTenant before EF opens a connection
//   2. Scalar OpenAPI UI (dev)    — interactive API explorer at /scalar/v1
//   3. Health endpoints           — /health/live, /health/ready, /replica-health
//   4. gRPC service bindings      — MapGrpcService<T>() for each stand-in service
//   5. REST controllers           — discovered via AddControllers()
//   6. Root redirect to Scalar    — / → /scalar/v1
//
// Each step is a single line so this file is a readable map of the host.
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using SaasCheckin.HttpApi.Host.Grpc;
using SaasCheckin.HttpApi.Host.Health;
using Scalar.AspNetCore;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class ApplicationBuilderExtensions
{
    /// <summary>
    /// Build the request pipeline. Components run in declaration order;
    /// reordering breaks tenant isolation (CurrentTenantMiddleware must
    /// precede anything that touches the DbContext).
    /// </summary>
    public static WebApplication UseSaasCheckinPipeline(this WebApplication app)
    {
        // Scalar OpenAPI UI ở /scalar/v1
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.MapScalarApiReference();
        }

        // Health endpoints
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = _ => false,  // chỉ check process alive
        });
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready"),
        });
        // I-805: Replica health endpoint — expose lag cho Grafana scrape
        app.MapReplicaHealth();

        // CurrentTenantMiddleware (chạy sớm — set ICurrentTenant trước EF)
        app.UseMiddleware<SaasCheckin.HttpApi.Host.Middleware.CurrentTenantMiddleware>();

        // gRPC services — bind qua raw POCO BindService() (Phase stand-in). Khi buf generate chạy (I-105)
        // sẽ thay bằng generated abstract base + MapGrpcService<T>() reflection.
        app.MapGrpcService<IdentityGrpcService>();
        app.MapGrpcService<EventGrpcService>();
        app.MapGrpcService<VenueGrpcService>();
        app.MapGrpcService<RegistrationGrpcService>();
        app.MapGrpcService<CheckInGrpcService>();

        // REST controllers (mirror gRPC for Playwright / Swagger)
        app.MapControllers();

        app.MapGet("/", () => Results.Redirect("/scalar/v1"));

        return app;
    }
}
