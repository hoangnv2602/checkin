using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Application.CheckIn.Commands;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.CheckIn.Services;
using SaasCheckin.EntityFrameworkCore.CheckIn.Repositories;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Infrastructure.CheckIn;

public sealed class CheckInInfrastructureModule : IBoundedContextModule
{
    public string Name => "CheckIn.Infrastructure";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ICheckInRecordRepository, CheckInRecordRepository>();
        services.AddSingleton<ICheckInCache, RedisCheckInCache>();
        services.AddSingleton<IQrSignatureVerifier, Ed25519QrSignatureVerifier>();
    }
}
