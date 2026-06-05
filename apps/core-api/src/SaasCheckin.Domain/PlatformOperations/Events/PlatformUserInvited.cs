using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.Events;

public sealed record PlatformUserInvited(
    PlatformUserId UserId,
    string Email,
    ValueObjects.PlatformRole Role,
    DateTimeOffset OccurredAt) : IDomainEvent;
