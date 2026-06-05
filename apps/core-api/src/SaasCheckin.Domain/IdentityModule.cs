namespace SaasCheckin.Domain.Identity;

/// <summary>
/// IdentityModule — bounded context marker.
/// Phase 0: registration body ở SaasCheckin.HttpApi.Host/Program.cs
/// Phase 1+ (I-101): sẽ implement IBoundedContextModule với DI
/// cho IUserRepository, IPasswordHasher, IClock.
/// </summary>
public sealed class IdentityModule
{
    public static string Name => "Identity";
}
