using System.Text.RegularExpressions;
using SaasCheckin.Shared.Domain.Core;     // Guard

namespace SaasCheckin.Domain.Identity.ValueObjects;

/// <summary>
/// Họ tên đầy đủ. Trim + collapse whitespace. Max 200 ký tự (match DB).
/// </summary>
public sealed record FullName
{
    public string Value { get; }

    private FullName(string value) => Value = value;

    public static FullName Create(string value)
    {
        Guard.NotNullOrWhiteSpace(value);

        var collapsed = Regex.Replace(value.Trim(), @"\s+", " ");
        if (collapsed.Length > 200)
            throw new ArgumentException("Họ tên quá dài (>200 ký tự).", nameof(value));

        return new FullName(collapsed);
    }

    public override string ToString() => Value;
}
