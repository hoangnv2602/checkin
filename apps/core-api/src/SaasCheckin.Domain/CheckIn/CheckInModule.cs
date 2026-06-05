using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.CheckIn.Specifications;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Domain.CheckIn;

/// <summary>
/// CheckIn bounded-context module (Phase 4, I-401).
/// Wire domain services. Repositories + cache đăng ký ở EF / Infrastructure.
/// </summary>
public sealed class CheckInModule : IBoundedContextModule
{
    public string Name => "CheckIn";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<CanCheckInSpecification>();
    }
}
