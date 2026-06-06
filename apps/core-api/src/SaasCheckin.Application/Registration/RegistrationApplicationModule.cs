using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.EntityFrameworkCore.Registration.Repositories;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Application.Registration;

/// <summary>
/// Registration application module — wires repositories + MediatR handlers.
/// Mọi DI registration nên go qua <c>AddRegistrationModule()</c> thay vì
/// wire trực tiếp trong Program.cs.
/// </summary>
public static class RegistrationApplicationModule
{
    public static IServiceCollection AddRegistrationModule(this IServiceCollection services)
    {
        services.AddScoped<ITicketTypeRepository, TicketTypeRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IRegistrationRepository, RegistrationRepository>();
        services.AddSingleton<IPricingService, PricingService>();
        return services;
    }
}

public sealed class RegistrationApplicationRegistration : IBoundedContextModule
{
    public string Name => "Registration.Application";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddRegistrationModule();
    }
}
