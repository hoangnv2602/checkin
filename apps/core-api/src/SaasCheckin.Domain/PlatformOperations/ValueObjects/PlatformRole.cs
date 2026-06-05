namespace SaasCheckin.Domain.PlatformOperations.ValueObjects;

/// <summary>
/// 3 roles cho PlatformOperations context (D12, ADR-0014).
/// Tách biệt hoàn toàn với tenant <see cref="Identity.ValueObjects.Role"/>.
/// </summary>
public enum PlatformRole
{
    PlatformOwner = 0,    // Full access, including billing + suspend tenants
    PlatformSupport = 1,  // Read-only + support actions
    PlatformEngineer = 2, // DB access, feature flags, deploy
}
