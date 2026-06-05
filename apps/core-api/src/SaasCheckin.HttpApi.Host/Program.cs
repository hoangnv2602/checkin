using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Scalar.AspNetCore;
using SaasCheckin.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Logging
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// OpenAPI (D8)
builder.Services.AddOpenApi();

// gRPC (kết nối Phase 0 stub, real impl Phase 4)
builder.Services.AddGrpc();

// Health checks (K8s convention)
builder.Services.AddHealthChecks()
    .AddNpgSql(
        connectionStringFactory: _ => builder.Configuration.GetConnectionString("Default")!,
        name: "postgres",
        tags: ["ready"])
    .AddRedis(
        redisConnectionString: builder.Configuration.GetConnectionString("Redis")!,
        name: "redis",
        tags: ["ready"]);

var app = builder.Build();

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

app.MapGet("/", () => Results.Redirect("/scalar/v1"));

app.Run();

public partial class Program;
