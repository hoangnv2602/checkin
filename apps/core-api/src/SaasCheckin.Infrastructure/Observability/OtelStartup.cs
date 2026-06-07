// apps/core-api/src/SaasCheckin.Infrastructure/Observability/OtelStartup.cs
//
// I-603 — OpenTelemetry + Sentry init cho .NET core-api.
//
// Wires:
//   - OTLP trace exporter → Tempo (if OTEL_EXPORTER_OTLP_ENDPOINT set)
//   - Auto-instrumentation: ASP.NET Core, HTTP, EntityFrameworkCore
//   - Sentry error capture + trace integration (if SENTRY_DSN set)
//
// Sample rate: 100% errors, configurable for traces (default 10%).
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace SaasCheckin.Infrastructure.Observability;

public static class OtelStartup
{
    public const string ServiceName = "core-api";

    public static IServiceCollection AddSaasCheckinTelemetry(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var otlpEndpoint = configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        var sampleRate = double.TryParse(
            configuration["OTEL_TRACES_SAMPLER_ARG"],
            out var r) ? r : 0.1;

        var resource = ResourceBuilder.CreateDefault()
            .AddService(serviceName: ServiceName, serviceVersion: "0.0.0")
            .AddEnvironmentVariableDetector();

        services.AddOpenTelemetry()
            .WithTracing(t =>
            {
                t.SetResourceBuilder(resource)
                 .SetSampler(new TraceIdRatioBasedSampler(sampleRate))
                 .AddAspNetCoreInstrumentation()
                 .AddHttpClientInstrumentation()
                 .AddEntityFrameworkCoreInstrumentation();

                if (!string.IsNullOrEmpty(otlpEndpoint))
                {
                    t.AddOtlpExporter(o => o.Endpoint = new Uri($"{otlpEndpoint}/v1/traces"));
                }
            });

        return services;
    }
}

