namespace SaasCheckin.Shared.Domain.Core;

/// <summary>
/// IClock — abstraction cho DateTime.UtcNow. Inject để test deterministic.
/// Phase 0 stub. Implementations: SystemClock, FakeClock (test).
/// </summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
