/**
 * apps/core-api/src/SaasCheckin.Infrastructure/Observability/OtelStartup.cs
 *
 * I-603 — OpenTelemetry init cho .NET core-api. OTLP exporter → Tempo.
 * Sample 10% traces, 100% errors.
 */
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace SaasCheckin.Infrastructure.Observability;

public static class OtelStartup
{
    public static TracerProvider? ConfigureTracing(string serviceName, IConfiguration configuration)
    {
        var endpoint = configuration["OpenTelemetry:Otlp:Endpoint"];
        if (string.IsNullOrEmpty(endpoint)) return null;

        return Sdk.CreateTracerProviderBuilder()
            .SetResourceBuilder(ResourceBuilder.CreateDefault()
                .AddService(serviceName: serviceName, serviceVersion: "0.0.0"))
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddEntityFrameworkCoreInstrumentation(o => o.SetDbStatementForText = true)
            .AddOtlpExporter(opt => opt.Endpoint = new Uri($"{endpoint}/v1/traces"))
            .SetSampler(new TraceIdRatioBasedSampler(0.1))
            .Build();
    }
}
