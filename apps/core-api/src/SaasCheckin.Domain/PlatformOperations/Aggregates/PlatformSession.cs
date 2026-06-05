using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.Aggregates;

/// <summary>
/// PlatformSession — refresh-token session (8h TTL, D12/ADR-0014).
/// Short-lived vs tenant session (30 days) vì privileged audience.
/// </summary>
public sealed class PlatformSession : AggregateRoot<PlatformSessionId>
{
    public PlatformUserId UserId { get; private set; }
    public string RefreshTokenHash { get; private set; } = default!;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public string? CreatedFromIp { get; private set; }

    private PlatformSession() : base(default!) { }

    private PlatformSession(
        PlatformUserId userId,
        string refreshTokenHash,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt,
        string? createdFromIp) : base(PlatformSessionId.New())
    {
        UserId = userId;
        RefreshTokenHash = refreshTokenHash;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
        CreatedFromIp = createdFromIp;
    }

    public static PlatformSession Create(
        PlatformUserId userId,
        string refreshTokenHash,
        TimeSpan ttl,
        IClock clock,
        string? fromIp = null)
    {
        Guard.NotNullStruct(userId, nameof(userId));
        Guard.NotNullOrWhiteSpace(refreshTokenHash, nameof(refreshTokenHash));
        if (ttl <= TimeSpan.Zero) throw new ArgumentException("TTL must be positive", nameof(ttl));
        Guard.NotNull(clock, nameof(clock));

        var now = clock.UtcNow;
        return new PlatformSession(userId, refreshTokenHash, now, now.Add(ttl), fromIp);
    }

    public void Revoke(IClock clock)
    {
        if (RevokedAt is not null) return;
        RevokedAt = clock.UtcNow;
    }

    public bool IsActive(IClock clock) =>
        RevokedAt is null && clock.UtcNow < ExpiresAt;
}
