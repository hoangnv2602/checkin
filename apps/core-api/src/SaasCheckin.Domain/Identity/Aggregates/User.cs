// =====================================================================
// File: Aggregates/User.cs
// Phase 1 preview — I-101 .NET Core 10 Identity context (D13 RBAC)
// Source of truth khi start code: docs/issues/phase-1-identity.md + ADR-0013 + ADR-0015
// =====================================================================

using SaasCheckin.Domain.Identity.Events;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain;          // AggregateRoot<TKey>, IDomainEvent
using SaasCheckin.Shared.Domain.Core;     // Guard, IClock

namespace SaasCheckin.Domain.Identity.Aggregates;

/// <summary>
/// User aggregate root. Lưu trên schema global (KHÔNG có tenant_id, KHÔNG RLS).
/// Mỗi user thuộc 0+ tenant qua <c>Membership</c> aggregate riêng — User KHÔNG
/// wrap Membership (xem ADR-0003 + database-schema.md § 4.1).
/// </summary>
public sealed class User : AggregateRoot<UserId>
{
    public Email Email { get; private set; } = default!;
    public FullName FullName { get; private set; } = default!;
    public string? PasswordHash { get; private set; }   // null khi SSO-only (Phase 2+)
    public string? AvatarUrl { get; private set; }
    public string? Locale { get; private set; }
    public DateTimeOffset? EmailVerifiedAt { get; private set; }
    public DateTimeOffset? LastLoginAt { get; private set; }
    public DateTimeOffset? LockedUntil { get; private set; }
    public int FailedLoginCount { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    // ----- Constructors -----

    /// <summary>EF Core ctor — KHÔNG gọi trong business code.</summary>
    private User() : base(default!) { }

    private User(UserId id, Email email, FullName fullName, string? passwordHash, IClock clock)
        : base(id)
    {
        Email = email;
        FullName = fullName;
        PasswordHash = passwordHash;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    // ----- Factory (lệnh duy nhất tạo User) -----

    /// <summary>
    /// Tạo user mới + emit <see cref="UserRegistered"/> domain event.
    /// Auth flow: Identity.RegisterUserUseCase → User.Register → save → outbox relay.
    /// </summary>
    public static User Register(
        Email email,
        FullName fullName,
        IPasswordHasher passwordHasher,
        string? plainTextPassword,
        IClock clock)
    {
        Guard.NotNull(email);
        Guard.NotNull(fullName);
        Guard.NotNull(passwordHasher);
        Guard.NotNull(clock);

        var hash = plainTextPassword is null
            ? null
            : passwordHasher.HashPassword(plainTextPassword);

        var user = new User(UserId.New(), email, fullName, hash, clock);
        user.AddDomainEvent(new UserRegistered(user.Id, user.Email, user.FullName, clock.UtcNow));
        return user;
    }

    // ----- Domain methods (mỗi cái emit 0-1 event + enforce invariant) -----

    public void VerifyEmail(IClock clock)
    {
        if (EmailVerifiedAt.HasValue)
            throw new BusinessRuleViolationException("Email đã verified trước đó.");

        EmailVerifiedAt = clock.UtcNow;
        Touch(clock);
        AddDomainEvent(new UserEmailVerified(Id, clock.UtcNow));
    }

    public void RecordSuccessfulLogin(IClock clock)
    {
        EnsureNotLocked(clock);

        LastLoginAt = clock.UtcNow;
        FailedLoginCount = 0;
        Touch(clock);
        // Không emit event — login event ghi vào audit_log (cross-cutting), không phải domain event.
    }

    public void RecordFailedLogin(IClock clock, int maxAttempts = 5, TimeSpan? lockoutDuration = null)
    {
        FailedLoginCount++;
        Touch(clock);

        if (FailedLoginCount >= maxAttempts)
        {
            var duration = lockoutDuration ?? TimeSpan.FromMinutes(15);
            LockedUntil = clock.UtcNow.Add(duration);
            AddDomainEvent(new UserLockedOut(Id, FailedLoginCount, LockedUntil.Value));
        }
    }

    public void ChangePassword(IPasswordHasher passwordHasher, string newPlainTextPassword, IClock clock)
    {
        Guard.NotNull(passwordHasher);
        Guard.NotNull(newPlainTextPassword);

        PasswordHash = passwordHasher.HashPassword(newPlainTextPassword);
        FailedLoginCount = 0;                                       // reset counter
        LockedUntil = null;                                         // nếu đang locked thì mở
        Touch(clock);
    }

    public void UpdateProfile(FullName fullName, string? avatarUrl, string? locale, IClock clock)
    {
        Guard.NotNull(fullName);
        FullName = fullName;
        AvatarUrl = avatarUrl;
        Locale = locale;
        Touch(clock);
    }

    // ----- Invariants / helpers -----

    public bool IsLocked(DateTimeOffset now) =>
        LockedUntil.HasValue && LockedUntil > now;

    private void EnsureNotLocked(IClock clock)
    {
        if (IsLocked(clock.UtcNow))
            throw new BusinessRuleViolationException(
                $"Tài khoản bị khoá đến {LockedUntil:O}. Thử lại sau.");
    }

    private void Touch(IClock clock)
    {
        UpdatedAt = clock.UtcNow;
    }
}
