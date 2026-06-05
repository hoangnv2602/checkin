using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.ValueObjects;

/// <summary>
/// Max attendees. Invariant: must be > 0; published event cannot reduce below sold count.
/// </summary>
public readonly record struct Capacity
{
    public int Value { get; }

    private Capacity(int value) => Value = value;

    public static Capacity Create(int value)
    {
        if (value <= 0) throw new ArgumentException("Capacity must be > 0", nameof(value));
        return new Capacity(value);
    }

    public static implicit operator int(Capacity c) => c.Value;
    public static explicit operator Capacity(int v) => Create(v);
}
