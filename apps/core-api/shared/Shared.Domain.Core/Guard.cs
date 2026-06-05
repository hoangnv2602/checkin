using System.Runtime.CompilerServices;

namespace SaasCheckin.Shared.Domain.Core;

/// <summary>
/// Guard — Argument validation helpers.
/// Thay thế cho thư viện CommunityToolkit.Guard (.NET 10 chưa built-in).
/// </summary>
public static class Guard
{
    public static T NotNull<T>(T? value, [CallerArgumentExpression(nameof(value))] string? paramName = null) where T : class
    {
        if (value is null) throw new ArgumentNullException(paramName);
        return value;
    }

    public static string NotNullOrEmpty(string? value, [CallerArgumentExpression(nameof(value))] string? paramName = null)
    {
        if (string.IsNullOrEmpty(value))
            throw new ArgumentException($"{paramName} không được rỗng.", paramName);
        return value;
    }

    public static string NotNullOrWhiteSpace(string? value, [CallerArgumentExpression(nameof(value))] string? paramName = null)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} không được trống.", paramName);
        return value;
    }

    public static int NotNegativeOrZero(int value, [CallerArgumentExpression(nameof(value))] string? paramName = null)
    {
        if (value <= 0) throw new ArgumentOutOfRangeException(paramName, $"{paramName} phải > 0");
        return value;
    }
}
