// apps/core-api/src/SaasCheckin.HttpApi.Host/Setup/MediatorServiceExtensions.cs
//
// MediatR + cross-cutting pipeline behaviors. Scans every assembly that
// hosts a Command/Query handler so handlers land in the DI container
// without explicit per-handler registration. The two open behaviors
// (Permission + Logging) wrap every request, in that order.
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Application.Common.Behaviors;

namespace SaasCheckin.HttpApi.Host.Setup;

public static class MediatorServiceExtensions
{
    /// <summary>
    /// Register MediatR scanning handler assemblies + open behaviors:
    ///   - PermissionBehavior : permission policy check (D13)
    ///   - LoggingBehavior    : structured request log
    /// </summary>
    public static IServiceCollection AddSaasCheckinMediator(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(SaasCheckin.Domain.Identity.IdentityModule).Assembly,
                typeof(SaasCheckin.Application.Identity.Commands.RegisterUserCommand).Assembly,
                typeof(SaasCheckin.Application.CheckIn.Commands.ScanQrCommand).Assembly,
                typeof(SaasCheckin.Application.Billing.Commands.SubscribeToPlanCommand).Assembly,
                typeof(SaasCheckin.Application.PlatformOperations.Commands.LoginCommand).Assembly,
                typeof(SaasCheckin.Application.EventManagement.Commands.CreateEventCommand).Assembly,
                typeof(SaasCheckin.Application.Registration.Commands.CreateOrderCommand).Assembly);
            cfg.AddOpenBehavior(typeof(PermissionBehavior<,>));
            cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
        });
        return services;
    }
}
