using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.ValueObjects;

/// <summary>
/// Email cho PlatformUser. Tách biệt với Identity.Email (vì 2 contexts có thể
/// diverge trong tương lai — VD: PlatformUser có thể cần sub-addressing rule).
/// </summary>
public sealed record Email
{
    public string Value { get; }

    private Email(string value) => Value = value.ToLowerInvariant();

    public static Email Create(string value)
    {
        Guard.NotNullOrWhiteSpace(value, nameof(value));
        var trimmed = value.Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            throw new ArgumentException($"Invalid email: {value}", nameof(value));
        return new Email(trimmed);
    }

    public override string ToString() => Value;
}
