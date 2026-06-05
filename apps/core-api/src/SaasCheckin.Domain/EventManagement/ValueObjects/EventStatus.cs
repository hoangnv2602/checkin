namespace SaasCheckin.Domain.EventManagement.ValueObjects;

/// <summary>
/// Event lifecycle state. Maps to Stateless state machine.
/// </summary>
public enum EventStatus
{
    Draft = 0,
    Published = 1,
    Cancelled = 2,
    Completed = 3,
}
