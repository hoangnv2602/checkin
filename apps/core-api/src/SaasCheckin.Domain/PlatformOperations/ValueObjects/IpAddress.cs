using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.ValueObjects;

/// <summary>
/// IP address cho audit log + IpAllowlistGuard. Lưu canonical IPv4/IPv6 string.
/// </summary>
public sealed record IpAddress
{
    public string Value { get; }

    private IpAddress(string value) => Value = value;

    public static IpAddress Parse(string value)
    {
        Guard.NotNullOrWhiteSpace(value, nameof(value));
        if (!System.Net.IPAddress.TryParse(value, out _))
            throw new ArgumentException($"Invalid IP: {value}", nameof(value));
        return new IpAddress(value);
    }

    public override string ToString() => Value;
}
