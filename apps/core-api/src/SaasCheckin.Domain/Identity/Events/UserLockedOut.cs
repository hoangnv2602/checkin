// File: Events/UserLockedOut.cs
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain;

namespace SaasCheckin.Domain.Identity.Events;

/// <summary>
/// User bị khoá sau N lần login fail. In-process handler có thể gửi email
/// cảnh báo + ghi security audit log.
/// </summary>
public sealed record UserLockedOut(
    UserId UserId,
    int FailedAttempts,
    DateTimeOffset LockedUntil
) : IDomainEvent;
