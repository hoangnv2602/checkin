using System.Text.RegularExpressions;
using SaasCheckin.Shared.Domain.Core;     // Guard

namespace SaasCheckin.Domain.Identity.ValueObjects;

/// <summary>
/// Email value object. Validate RFC 5322 + normalize về lowercase
/// (match với DB column `users.email` kiểu CITEXT — case-insensitive,
/// unique theo giá trị lowercase).
/// </summary>
public sealed record Email
{
    // RFC 5322 simplified — không cover mọi edge case nhưng đủ cho SaaS B2B.
    private static readonly Regex EmailRegex = new(
        @"^(?!\.)(""([^""\r\\]|\\[""\r\\])*""|([-a-zA-Z0-9!#$%&'*+/=?^_`{|}~]|(?<!\.)\.)+)" +
        @")@[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,62})+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public string Value { get; }

    private Email(string value) => Value = value;

    public static Email Create(string value)
    {
        Guard.NotNullOrWhiteSpace(value);

        var trimmed = value.Trim();
        if (trimmed.Length > 254)                                            // RFC 5321 max
            throw new ArgumentException("Email quá dài (>254 ký tự).", nameof(value));

        if (!EmailRegex.IsMatch(trimmed))
            throw new ArgumentException($"Email không hợp lệ: {value}", nameof(value));

        return new Email(trimmed.ToLowerInvariant());
    }

    public override string ToString() => Value;
}
