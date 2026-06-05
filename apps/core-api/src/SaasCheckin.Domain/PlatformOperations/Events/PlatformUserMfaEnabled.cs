using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.Events;

public sealed record PlatformUserMfaEnabled(
    PlatformUserId UserId,
    DateTimeOffset OccurredAt) : IDomainEvent;
