// apps/core-api/src/SaasCheckin.Infrastructure/Observability/OtelStartup.cs
//
// I-603 — OpenTelemetry init cho .NET core-api. OTLP exporter → Tempo.
// Sample 10% traces, 100% errors.
//
// TODO(phase-9): add OpenTelemetry packages (OpenTelemetry, OpenTelemetry.Extensions.Hosting,
//   OpenTelemetry.Instrumentation.AspNetCore, OpenTelemetry.Instrumentation.Http,
//   OpenTelemetry.Instrumentation.EntityFrameworkCore, OpenTelemetry.Exporter.OpenTelemetryProtocol)
//   to Directory.Packages.props + SaasCheckin.Infrastructure.csproj, then restore the body below.

using Microsoft.Extensions.Configuration;

namespace SaasCheckin.Infrastructure.Observability;

public static class OtelStartup
{
    public static object? ConfigureTracing(string serviceName, IConfiguration configuration)
    {
        // OTel packages not yet wired (see file header). Returns null so Host startup is a no-op.
        return null;
    }
}
