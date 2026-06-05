using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.ValueObjects;

/// <summary>
/// TOTP secret (RFC 6238). Lưu dạng base32 string; verifier dùng
/// <see cref="Services.ITotpCodeVerifier"/> để validate codes.
/// </summary>
public sealed record MfaSecret
{
    public string Base32 { get; }

    private MfaSecret(string base32) => Base32 = base32;

    /// <summary>Generate a new random 160-bit secret encoded as base32.</summary>
    public static MfaSecret Generate()
    {
        var bytes = new byte[20]; // 160 bits per RFC 6238 recommendation
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return new MfaSecret(Base32Encode(bytes));
    }

    public static MfaSecret Parse(string base32)
    {
        Guard.NotNullOrWhiteSpace(base32, nameof(base32));
        return new MfaSecret(base32);
    }

    private static string Base32Encode(byte[] data)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var sb = new System.Text.StringBuilder();
        int buffer = 0, bitsLeft = 0;
        foreach (var b in data)
        {
            buffer = (buffer << 8) | b;
            bitsLeft += 8;
            while (bitsLeft >= 5)
            {
                bitsLeft -= 5;
                sb.Append(alphabet[(buffer >> bitsLeft) & 0x1F]);
            }
        }
        if (bitsLeft > 0) sb.Append(alphabet[(buffer << (5 - bitsLeft)) & 0x1F]);
        return sb.ToString();
    }
}
