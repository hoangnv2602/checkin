namespace SaasCheckin.Shared.Domain.Core;

/// <summary>
/// ValueObject — base class cho value object (immutable, equality by value).
/// </summary>
public abstract class ValueObject
{
    protected abstract IEnumerable<object?> GetEqualityComponents();

    public override bool Equals(object? obj)
    {
        if (obj is not ValueObject other || GetType() != other.GetType()) return false;
        return GetEqualityComponents().SequenceEqual(other.GetEqualityComponents());
    }

    public override int GetHashCode()
        => GetEqualityComponents()
            .Aggregate(1, (current, obj) => HashCode.Combine(current, obj));
}
