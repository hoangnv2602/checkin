using System.Security.Cryptography;
using System.Text;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.PlatformOperations.Services;

/// <summary>
/// RFC 6238 TOTP verifier — HMAC-SHA1, 6 digits, 30s period, ±1 step skew.
/// Dùng cho <see cref="Aggregates.PlatformUser.EnableMfa"/>.
/// </summary>
public sealed class TotpCodeVerifier : ITotpCodeVerifier
{
    private const int Digits = 6;
    private const int PeriodSeconds = 30;
    private const int SkewSteps = 1;

    public bool Verify(MfaSecret secret, string code, DateTimeOffset now)
    {
        Guard.NotNull(secret, nameof(secret));
        Guard.NotNullOrWhiteSpace(code, nameof(code));
        code = code.Trim().Replace(" ", "");
        if (code.Length != Digits || !code.All(char.IsDigit)) return false;

        var key = Base32Decode(secret.Base32);
        long unixTime = now.ToUnixTimeSeconds();
        long timeStep = unixTime / PeriodSeconds;

        for (long t = timeStep - SkewSteps; t <= timeStep + SkewSteps; t++)
        {
            if (ComputeCode(key, t) == code) return true;
        }
        return false;
    }

    private static string ComputeCode(byte[] key, long timeStep)
    {
        var data = BitConverter.GetBytes(timeStep);
        if (BitConverter.IsLittleEndian) Array.Reverse(data);
        // RFC 6238 mandates HMAC-SHA1; suppress CA5350 weak-algo warning.
#pragma warning disable CA5350
        using var hmac = new HMACSHA1(key);
#pragma warning restore CA5350
        var hash = hmac.ComputeHash(data);
        int offset = hash[hash.Length - 1] & 0x0F;
        int binary =
            ((hash[offset] & 0x7F) << 24) |
            ((hash[offset + 1] & 0xFF) << 16) |
            ((hash[offset + 2] & 0xFF) << 8) |
            (hash[offset + 3] & 0xFF);
        int otp = binary % (int)Math.Pow(10, Digits);
        return otp.ToString($"D{Digits}");
    }

    private static byte[] Base32Decode(string input)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        input = input.TrimEnd('=').ToUpperInvariant();
        var bytes = new List<byte>(input.Length * 5 / 8);
        int buffer = 0, bitsLeft = 0;
        foreach (var c in input)
        {
            int val = alphabet.IndexOf(c);
            if (val < 0) throw new FormatException($"Invalid base32 char: {c}");
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8)
            {
                bitsLeft -= 8;
                bytes.Add((byte)((buffer >> bitsLeft) & 0xFF));
            }
        }
        return bytes.ToArray();
    }
}
