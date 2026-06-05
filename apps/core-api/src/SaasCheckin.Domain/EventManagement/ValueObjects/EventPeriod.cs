using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.ValueObjects;

/// <summary>
/// [startAt, endAt) với invariant start &lt; end.
/// </summary>
public sealed record EventPeriod
{
    public DateTimeOffset StartAt { get; }
    public DateTimeOffset EndAt { get; }

    private EventPeriod(DateTimeOffset start, DateTimeOffset end)
    {
        StartAt = start;
        EndAt = end;
    }

    public static EventPeriod Create(DateTimeOffset startAt, DateTimeOffset endAt)
    {
        Guard.NotNullStruct(startAt, nameof(startAt));
        Guard.NotNullStruct(endAt, nameof(endAt));
        if (startAt >= endAt)
            throw new ArgumentException($"startAt ({startAt:O}) must be < endAt ({endAt:O})");
        return new EventPeriod(startAt, endAt);
    }

    public TimeSpan Duration => EndAt - StartAt;
}
