using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Billing.Services;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Application.Billing;

public static class BillingApplicationModule
{
    public static IServiceCollection AddBillingApplication(this IServiceCollection s)
    {
        s.AddScoped<IPlanLimitEnforcer, Services.PlanLimitEnforcer>();
        return s;
    }
}

public sealed class BillingApplicationRegistration : IBoundedContextModule
{
    public string Name => "Billing.Application";
    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddBillingApplication();
    }
}
