using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Shared.Application.Contracts;

namespace SaasCheckin.Infrastructure.Registration;

/// <summary>
/// Registration infrastructure module (Phase 3, I-301) — wires Ed25519
/// QR code generator + key provider. Key provider: dev = FileSystem
/// (load/seed at /etc/api-gateway/keys/{tenant}.key); production override
/// qua configuration (Phase 6+ Vault/KMS).
/// </summary>
public sealed class RegistrationInfrastructureModule : IBoundedContextModule
{
    public string Name => "Registration.Infrastructure";

    public void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IKeyProvider, FileSystemQrKeyProvider>();
        services.AddSingleton<IQrCodeGenerator, Ed25519QrCodeGenerator>();
    }
}
