// File: Events/UserRegistered.cs
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Domain.Core;          // IDomainEvent

namespace SaasCheckin.Domain.Identity.Events;

/// <summary>
/// Domain event: user vừa đăng ký. In-process qua MediatR (gửi welcome email,
/// tạo default preferences, …). KHÔNG phải integration event — bounded context
/// khác không cần biết ngay lập tức.
/// </summary>
public sealed record UserRegistered(
    UserId UserId,
    Email Email,
    FullName FullName,
    DateTimeOffset OccurredAt
) : IDomainEvent;
