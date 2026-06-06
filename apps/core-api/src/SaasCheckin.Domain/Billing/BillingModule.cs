using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Billing.Services;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Domain.Billing;

/// <summary>
/// Billing bounded-context module (Phase 5, I-501).
/// Wire domain services. Repositories + plan limit enforcer registered ở Application.
/// </summary>
public sealed class BillingModule : IBoundedContextModule
{
    public string Name => "Billing";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        // IPlanLimitEnforcer, ISubscriptionRepository, IPlanRepository, IInvoiceRepository
        // đăng ký ở Application + Infrastructure (cần DbContext + Redis cache).
    }
}
