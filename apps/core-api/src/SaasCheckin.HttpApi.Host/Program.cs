// apps/core-api/src/SaasCheckin.HttpApi.Host/Program.cs
//
// Composition root. All wiring lives in Setup/* extension methods so
// this file is a readable map of "what runs in what order":
//   1. Builder + Serilog logging
//   2. Service registrations (persistence → bounded contexts → mediator
//      → API surface → auth → health → observability)
//   3. Build + run pipeline
//
// Each Setup/* file owns one concern. To add a new bounded context,
// edit Setup/BoundedContextServiceExtensions.cs. To add a new middleware,
// edit Setup/ApplicationBuilderExtensions.cs.
using SaasCheckin.HttpApi.Host.Setup;

var builder = WebApplication.CreateBuilder(args);

builder.UseSaasCheckinSerilog();
builder.Services
    .AddSaasCheckinPersistence(builder.Configuration)
    .AddSaasCheckinBoundedContexts(builder.Configuration)
    .AddSaasCheckinMediator()
    .AddSaasCheckinApiSurface()
    .AddSaasCheckinAuth()
    .AddSaasCheckinHealthChecks(builder.Configuration);
builder.AddSaasCheckinObservability();

var app = builder.Build();
app.UseSaasCheckinPipeline();
app.Run();

public partial class Program;
