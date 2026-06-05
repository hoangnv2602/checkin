// File: Events/UserEmailVerified.cs
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain;

namespace SaasCheckin.Domain.Identity.Events;

/// <summary>
/// User đã verify email. Trigger cập nhật cờ "verified" cho mọi Membership
/// (in-process) + mở khóa tính năng invite member, gửi order confirmation, …
/// </summary>
public sealed record UserEmailVerified(
    UserId UserId,
    DateTimeOffset OccurredAt
) : IDomainEvent;
