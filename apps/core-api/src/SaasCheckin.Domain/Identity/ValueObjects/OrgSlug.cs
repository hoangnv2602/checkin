using System.Text.RegularExpressions;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.ValueObjects;

/// <summary>
/// Organization slug — URL-safe, lowercase, unique toàn cục.
/// Quy tắc: a-z 0-9 + dấu gạch ngang, không bắt đầu/kết thúc bằng '-', dài 3-40.
/// </summary>
public sealed record OrgSlug
{
    // 3-40 ký tự; char đầu/cuối alphanumeric, giữa cho phép '-'
    private static readonly Regex SlugRegex = new(
        @"^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$",
        RegexOptions.Compiled);

    public string Value { get; }

    private OrgSlug(string value) => Value = value;

    public static OrgSlug Create(string value)
    {
        Guard.NotNullOrWhiteSpace(value);

        var normalized = value.Trim().ToLowerInvariant();

        if (!SlugRegex.IsMatch(normalized))
            throw new ArgumentException(
                $"OrgSlug không hợp lệ: '{value}'. " +
                "Chỉ chấp nhận chữ thường a-z, số 0-9, dấu gạch ngang; 3-40 ký tự; " +
                "không bắt đầu/kết thúc bằng '-'.",
                nameof(value));

        return new OrgSlug(normalized);
    }

    public override string ToString() => Value;
}
