using FluentAssertions;
using SaasCheckin.Domain.PlatformOperations.Services;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using Xunit;

namespace SaasCheckin.Domain.Tests.PlatformOperations;

/// <summary>
/// Unit tests for TotpCodeVerifier (RFC 6238). Verifies accept valid code,
/// reject wrong code, accept within skew, reject malformed.
/// </summary>
public class TotpCodeVerifierTests
{
    [Fact]
    public void Verify_accepts_current_code()
    {
        var secret = MfaSecret.Generate();
        var verifier = new TotpCodeVerifier();
        // Compute expected code at "now"
        var now = DateTimeOffset.UtcNow;
        var code = ComputeCodeForTest(secret, now);
        verifier.Verify(secret, code, now).Should().BeTrue();
    }

    [Fact]
    public void Verify_rejects_wrong_code()
    {
        var secret = MfaSecret.Generate();
        var verifier = new TotpCodeVerifier();
        verifier.Verify(secret, "000000", DateTimeOffset.UtcNow).Should().BeFalse();
    }

    [Fact]
    public void Verify_accepts_code_within_skew()
    {
        var secret = MfaSecret.Generate();
        var verifier = new TotpCodeVerifier();
        var now = DateTimeOffset.UtcNow;
        var codeAtMinus30s = ComputeCodeForTest(secret, now.AddSeconds(-30));
        verifier.Verify(secret, codeAtMinus30s, now).Should().BeTrue();
    }

    [Fact]
    public void Verify_rejects_malformed_code()
    {
        var secret = MfaSecret.Generate();
        var verifier = new TotpCodeVerifier();
        verifier.Verify(secret, "abc123", DateTimeOffset.UtcNow).Should().BeFalse();
        verifier.Verify(secret, "12345", DateTimeOffset.UtcNow).Should().BeFalse();
        verifier.Verify(secret, "1234567", DateTimeOffset.UtcNow).Should().BeFalse();
    }

    [Fact]
    public void Verify_throws_for_empty_code()
    {
        var secret = MfaSecret.Generate();
        var verifier = new TotpCodeVerifier();
        Action act = () => verifier.Verify(secret, "", DateTimeOffset.UtcNow);
        act.Should().Throw<ArgumentException>();
    }

    // Mirror TotpCodeVerifier.ComputeCode for test purposes
    private static string ComputeCodeForTest(MfaSecret secret, DateTimeOffset now)
    {
        const int Digits = 6;
        const int PeriodSeconds = 30;
        var key = Base32Decode(secret.Base32);
        long timeStep = now.ToUnixTimeSeconds() / PeriodSeconds;
        var data = BitConverter.GetBytes(timeStep);
        if (BitConverter.IsLittleEndian) Array.Reverse(data);
#pragma warning disable CA5350
        using var hmac = new System.Security.Cryptography.HMACSHA1(key);
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
        var bytes = new System.Collections.Generic.List<byte>(input.Length * 5 / 8);
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
