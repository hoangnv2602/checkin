using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Domain.Registration;

/// <summary>
/// Registration bounded-context module (Phase 3, I-301).
/// Wire domain services: IPricingService + IQrCodeGenerator.
/// Repositories đăng ký ở EntityFrameworkCore (cần DbContext).
/// </summary>
public sealed class RegistrationModule : IBoundedContextModule
{
    public string Name => "Registration";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IPricingService, PricingService>();
        // IQrCodeGenerator registered ở Infrastructure (cần Ed25519 key provider / Redis cache).
    }
}
