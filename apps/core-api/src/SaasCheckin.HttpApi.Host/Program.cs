using MediatR;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using SaasCheckin.Application.Common.Behaviors;
using SaasCheckin.Domain.Identity;
using SaasCheckin.HttpApi.Host.Grpc;
using SaasCheckin.Infrastructure.Extensions;
using SaasCheckin.Shared.Application.Extensions;
using Scalar.AspNetCore;
using Serilog;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Logging
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console());

// OpenAPI (D8)
builder.Services.AddOpenApi();

// gRPC
builder.Services.AddGrpc();

// Redis (JWT signing key cache + refresh tokens)
var redisConn = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrEmpty(redisConn))
{
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
        ConnectionMultiplexer.Connect(redisConn));
}

// DbContext + Identity repositories + RLS interceptor
builder.Services.AddSaasCheckinDbContext(builder.Configuration);

// Identity bounded-context module (BCrypt + JWT signing)
builder.Services.AddBoundedContextModule<IdentityModule>(builder.Configuration);

// Application services (ICurrentTenant, IPermissionChecker, IIntegrationEventBus)
builder.Services.AddSaasCheckinApplication();

// MediatR — scan both Application (handlers) + Domain (domain event handlers).
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssemblies(
        typeof(SaasCheckin.Domain.Identity.IdentityModule).Assembly,
        typeof(SaasCheckin.Application.Identity.Commands.RegisterUserCommand).Assembly);
    cfg.AddOpenBehavior(typeof(PermissionBehavior<,>));
    cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
});

// Controllers (REST endpoints — Phase 1 mirror gRPC for BFF/Playwright tests)
builder.Services.AddControllers();

// JWT bearer (for REST controllers / future SignalR) — gRPC uses metadata
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer();
builder.Services.AddAuthorization();

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

// CurrentTenantMiddleware (chạy sớm — set ICurrentTenant trước EF)
app.UseMiddleware<SaasCheckin.HttpApi.Host.Middleware.CurrentTenantMiddleware>();

// REST controllers (Phase 1 BFF → core-api goes via REST, not gRPC — see I-102 plan note)
// gRPC service registration is on hold until `buf generate` chạy (I-105) — Phase 1
// raw POCO binding với grpc-dnet yêu cầu generated abstract base với static `Service`
// field mà ta chưa có.

// REST controllers
app.MapControllers();

app.MapGet("/", () => Results.Redirect("/scalar/v1"));

app.Run();

public partial class Program;
