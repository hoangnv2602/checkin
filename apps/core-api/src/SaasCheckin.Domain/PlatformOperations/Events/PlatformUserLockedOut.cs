using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.Events;

public sealed record PlatformUserLockedOut(
    PlatformUserId UserId,
    string Email,
    DateTimeOffset OccurredAt) : IDomainEvent;
