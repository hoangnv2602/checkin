using SaasCheckin.Domain.Billing.Aggregates;

namespace SaasCheckin.Domain.Billing.Services;

/// <summary>
/// IPlanLimitEnforcer — check usage hiện tại vs plan limit trước khi
/// mutation (CreateEvent, RegisterAttendee, InviteMember). Trả
/// PlanLimitExceeded với details rõ ràng.
/// </summary>
public interface IPlanLimitEnforcer
{
    Task<PlanLimitCheck> CheckAsync(
        Guid organizationId,
        PlanLimitKind kind,
        int requestedDelta = 1,
        CancellationToken ct = default);
}

public enum PlanLimitKind
{
    ActiveEvents,
    AttendeesThisMonth,
    StaffSeats
}

public sealed record PlanLimitCheck(
    bool Allowed,
    string? Code,
    int? Limit,
    int? Current,
    string? Message)
{
    public static PlanLimitCheck Ok() => new(true, null, null, null, null);
    public static PlanLimitCheck Exceeded(int limit, int current, string message) =>
        new(false, "plan_limit_exceeded", limit, current, message);
    public static PlanLimitCheck NoSubscription() =>
        new(false, "no_subscription", null, null, "Organization has no active subscription");
}
