// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/BoundedContextServiceExtensions.cs
//
// Single entry point for every bounded-context module registration.
// Grouped here so Program.cs reads as a one-line composition and so a new
// bounded context lands in one obvious place.
//
// Each context is 3 layers (Domain / Application / Infrastructure) where
// they exist; this method invokes them in that order. Some contexts (e.g.
// PlatformOperations) only have Domain + Application in Phase 0.
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Application.Billing;
using SaasCheckin.Application.Registration;
using SaasCheckin.Application.PlatformOperations;
using SaasCheckin.Domain.CheckIn;
using SaasCheckin.Domain.Identity;
using SaasCheckin.Domain.PlatformOperations;
using SaasCheckin.Infrastructure.Billing;
using SaasCheckin.Infrastructure.CheckIn;
using SaasCheckin.Infrastructure.EventManagement;
using SaasCheckin.Infrastructure.Registration;
using SaasCheckin.Shared.Application.Extensions;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class BoundedContextServiceExtensions
{
    /// <summary>
    /// Wire all bounded contexts in the order:
    ///   1. Domain module  (pure domain services)
    ///   2. Infrastructure module  (repos / adapters)
    ///   3. Application module  (use-case handlers, MediatR-discovered)
    /// Plus the cross-cutting application services (ICurrentTenant,
    /// IPermissionChecker, IIntegrationEventBus).
    /// </summary>
    public static IServiceCollection AddSaasCheckinBoundedContexts(
        this IServiceCollection services, IConfiguration configuration)
    {
        // Identity — BCrypt + JWT signing
        services.AddBoundedContextModule<IdentityModule>(configuration);

        // Registration (I-301) — Domain (PricingService) + Application (repos/handlers) + Infrastructure (Ed25519 QR)
        services.AddBoundedContextModule<SaasCheckin.Domain.Registration.RegistrationModule>(configuration);
        services.AddBoundedContextModule<RegistrationInfrastructureModule>(configuration);
        services.AddRegistrationModule();

        // CheckIn (I-401) — Domain (CanCheckInSpecification) + Infrastructure (repo + Redis cache + Ed25519 verifier)
        services.AddBoundedContextModule<CheckInModule>(configuration);
        services.AddBoundedContextModule<CheckInInfrastructureModule>(configuration);

        // Billing (I-501) — Domain + Infrastructure (in-memory repos, Phase 0) + Application (IPlanLimitEnforcer)
        services.AddBoundedContextModule<SaasCheckin.Domain.Billing.BillingModule>(configuration);
        services.AddBoundedContextModule<BillingInfrastructureModule>(configuration);
        services.AddBillingApplication();

        // PlatformOperations (I-107) — TOTP verifier + DI cho platform auth
        services.AddBoundedContextModule<PlatformOperationsModule>(configuration);
        services.AddPlatformApplication();

        // EventManagement (I-201) — Domain + Application (MediatR) + Infrastructure (in-memory repos, Phase 0)
        services.AddBoundedContextModule<SaasCheckin.Domain.EventManagement.EventManagementModule>(configuration);
        services.AddBoundedContextModule<SaasCheckin.Application.EventManagement.EventManagementApplicationModule>(configuration);
        services.AddBoundedContextModule<EventManagementInfrastructureModule>(configuration);

        // Cross-cutting application services: ICurrentTenant, IPermissionChecker, IIntegrationEventBus
        services.AddSaasCheckinApplication();

        return services;
    }
}
