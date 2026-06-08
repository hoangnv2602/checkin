// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/ObservabilityServiceExtensions.cs
//
// I-603 — OpenTelemetry traces → OTLP (Tempo) and Sentry error capture.
//
// Both are no-ops when the corresponding env (OTEL_EXPORTER_OTLP_ENDPOINT
// / SENTRY_DSN) is unset, which keeps dev mode overhead-free. Sentry
// is applied at the WebHost level (its SDK hooks into the host pipeline)
// so this extension takes the full WebApplicationBuilder rather than
// just the IServiceCollection.
using SaasCheckin.Infrastructure.Observability;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class ObservabilityServiceExtensions
{
    /// <summary>
    /// Wire OpenTelemetry (always safe; no-op without OTLP endpoint) and
    /// Sentry (only when SENTRY_DSN is set, to avoid touching the host
    /// pipeline in dev).
    /// </summary>
    public static WebApplicationBuilder AddSaasCheckinObservability(
        this WebApplicationBuilder builder)
    {
        // I-603: OpenTelemetry traces → OTLP (Tempo) + Sentry error capture.
        builder.Services.AddSaasCheckinTelemetry(builder.Configuration);

        // I-603: Sentry.AspNetCore auto-captures unhandled exceptions + integrates with OTel.
        if (!string.IsNullOrEmpty(builder.Configuration["SENTRY_DSN"]))
        {
            builder.WebHost.UseSentry(o =>
            {
                o.Dsn = builder.Configuration["SENTRY_DSN"];
                o.Environment = builder.Environment.EnvironmentName;
                o.TracesSampleRate = 0.1;
                o.SendDefaultPii = false;
            });
        }
        return builder;
    }
}
