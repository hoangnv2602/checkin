using SaasCheckin.Domain.PlatformOperations.Events;
using SaasCheckin.Domain.PlatformOperations.Services;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

namespace SaasCheckin.Domain.PlatformOperations.Aggregates;

/// <summary>
/// PlatformUser — super-admin user cho checkin-admin (D12, ADR-0014).
/// KHÔNG có tenant_id; lưu trên schema global với RLS bypass.
/// </summary>
public sealed class PlatformUser : AggregateRoot<PlatformUserId>
{
    public Email Email { get; private set; } = default!;
    public string FullName { get; private set; } = default!;
    public string PasswordHash { get; private set; } = default!;
    public PlatformRole Role { get; private set; }
    public bool MfaEnabled { get; private set; }
    public MfaSecret? MfaSecret { get; private set; }
    public DateTimeOffset? LastLoginAt { get; private set; }
    public DateTimeOffset? LockedUntil { get; private set; }
    public int FailedLoginCount { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    // EF ctor
    private PlatformUser() : base(default!) { }

    private PlatformUser(
        PlatformUserId id,
        Email email,
        string fullName,
        string passwordHash,
        PlatformRole role,
        IClock clock) : base(id)
    {
        Email = email;
        FullName = fullName;
        PasswordHash = passwordHash;
        Role = role;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>
    /// Invite platform user. Created without MFA — must setup on first login.
    /// </summary>
    public static PlatformUser Invite(
        Email email,
        string fullName,
        IPasswordHasher passwordHasher,
        string plainTextPassword,
        PlatformRole role,
        IClock clock)
    {
        Guard.NotNull(passwordHasher, nameof(passwordHasher));
        Guard.NotNullOrWhiteSpace(plainTextPassword, nameof(plainTextPassword));
        if (plainTextPassword.Length < 12)
            throw new ArgumentException("Platform password must be ≥12 chars", nameof(plainTextPassword));
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ArgumentException("Full name required", nameof(fullName));

        var user = new PlatformUser(
            PlatformUserId.New(),
            email,
            fullName.Trim(),
            passwordHasher.HashPassword(plainTextPassword),
            role,
            clock);

        user.RaiseDomainEvent(new PlatformUserInvited(user.Id, user.Email.Value, user.Role, clock.UtcNow));
        return user;
    }

    /// <summary>
    /// Verify password. Returns false on bad password; increments failed count + locks after 5.
    /// Throws <see cref="InvalidOperationException"/> when locked.
    /// </summary>
    public bool VerifyPassword(string plainTextPassword, IPasswordHasher hasher, IClock clock)
    {
        if (LockedUntil.HasValue && clock.UtcNow < LockedUntil.Value)
            throw new InvalidOperationException(
                $"PlatformUser is locked until {LockedUntil:O}");

        if (!hasher.VerifyPassword(plainTextPassword, PasswordHash))
        {
            FailedLoginCount++;
            if (FailedLoginCount >= 5)
            {
                LockedUntil = clock.UtcNow.AddMinutes(15);
                RaiseDomainEvent(new PlatformUserLockedOut(Id, Email.Value, clock.UtcNow));
            }
            UpdatedAt = clock.UtcNow;
            return false;
        }

        FailedLoginCount = 0;
        LockedUntil = null;
        LastLoginAt = clock.UtcNow;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new PlatformUserLoggedIn(Id, clock.UtcNow));
        return true;
    }

    /// <summary>
    /// Setup MFA: store secret + mark enabled after first code verification.
    /// </summary>
    public MfaSecret EnableMfa(string totpCode, ITotpCodeVerifier verifier, IClock clock)
    {
        if (MfaSecret is null)
        {
            MfaSecret = MfaSecret.Generate();
        }
        if (!verifier.Verify(MfaSecret, totpCode, clock.UtcNow))
            throw new UnauthorizedAccessException("Invalid TOTP code");
        MfaEnabled = true;
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new PlatformUserMfaEnabled(Id, clock.UtcNow));
        return MfaSecret;
    }

    /// <summary>Test/seed helper: ensure MFA secret exists without verifying code.</summary>
    public MfaSecret ProvisionMfaSecret()
    {
        MfaSecret ??= MfaSecret.Generate();
        return MfaSecret;
    }
}
