namespace SaasCheckin.Domain.EventManagement.ValueObjects;

/// <summary>
/// Session lifecycle. Mỗi Session aggregate là 1 track/time-slot của 1 Event.
///   Draft → Scheduled → Started → Ended
///                ↘ Cancelled (chỉ khi còn Draft/Scheduled)
/// </summary>
public enum SessionStatus
{
    Draft = 0,
    Scheduled = 1,
    Started = 2,
    Ended = 3,
    Cancelled = 4,
}
