using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Shared.Application.Authorization;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Application.Tenancy;
using SaasCheckin.Shared.Application.Contracts;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Shared.Application.Extensions;

/// <summary>
/// Shared application registration helpers. Identity module use pattern
/// <c>AddBoundedContextModule&lt;IdentityModule&gt;()</c>; Application services
/// (MediatR, validators, behaviors) wire qua <c>AddSaasCheckinApplication()</c>.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Register 1 bounded context module — calls <c>module.Register(services, config)</c>.
    /// </summary>
    public static IServiceCollection AddBoundedContextModule<TModule>(
        this IServiceCollection services,
        IConfiguration configuration)
        where TModule : IBoundedContextModule, new()
    {
        var module = new TModule();
        module.Register(services, configuration);
        return services;
    }

    /// <summary>
    /// Register core application services: ICurrentTenant, IPermissionChecker,
    /// IIntegrationEventBus. HTTP context accessor for permission checker
    /// (reads JWT claim).
    /// </summary>
    public static IServiceCollection AddSaasCheckinApplication(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentTenant, CurrentTenant>();
        services.AddScoped<IPermissionChecker, JwtClaimPermissionChecker>();
        services.AddScoped<IIntegrationEventBus, InMemoryIntegrationEventBus>();
        return services;
    }
}
