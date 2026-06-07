// apps/core-api/src/SaasCheckin.Infrastructure/Billing/BillingInfrastructureModule.cs
//
// Phase 0 in-memory registrations for Billing bounded-context repositories.
// Mirrors the CheckInInfrastructureModule shape: an IBoundedContextModule
// that wires the repository interfaces to concrete impls at the
// composition root (Program.cs).
//
// IPlanLimitEnforcer is registered in BillingApplicationModule (Application
// layer — I-501), not here. That registration is invoked from Program.cs
// via `builder.Services.AddBillingApplication()`.
//
// Phase 5+ (I-501 EF Core migration) will replace these in-memory stubs
// with EF Core-backed implementations, but the registration shape is
// preserved so handlers don't need to change.
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Infrastructure.Billing;

public sealed class BillingInfrastructureModule : IBoundedContextModule
{
    public string Name => "Billing.Infrastructure";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ISubscriptionRepository, InMemorySubscriptionRepository>();
        services.AddScoped<IPlanRepository, InMemoryPlanRepository>();
        services.AddScoped<IInvoiceRepository, InMemoryInvoiceRepository>();
    }
}
