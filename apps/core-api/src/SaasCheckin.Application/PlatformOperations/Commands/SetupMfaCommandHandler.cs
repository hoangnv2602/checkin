using System.Text;
using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Domain.Identity.Services;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.PlatformOperations.Commands;

public sealed class SetupMfaCommandHandler : IRequestHandler<SetupMfaCommand, PlatformMfaSetupResponse>
{
    private const string Issuer = "saas-checkin";

    private readonly IJwtTokenService _jwt;
    private readonly IPlatformUserRepository _users;

    public SetupMfaCommandHandler(
        IJwtTokenService jwt,
        IPlatformUserRepository users)
    {
        _jwt = jwt;
        _users = users;
    }

    public async Task<PlatformMfaSetupResponse> Handle(SetupMfaCommand cmd, CancellationToken ct)
    {
        var verified = await _jwt.VerifyPlatformAccessAsync(cmd.SetupToken, ct)
            ?? throw new UnauthorizedAccessException("Setup token không hợp lệ hoặc đã hết hạn.");

        var user = await _users.FindByIdAsync(PlatformUserId.From(verified.UserId), ct)
            ?? throw new UnauthorizedAccessException("User không tồn tại.");

        var secret = user.ProvisionMfaSecret();
        await _users.UpdateAsync(user, ct);

        var otpauthUrl = BuildOtpauthUrl(user.Email.Value, secret.Base32);
        var qrCodeDataUrl = await QrCodeDataUrlAsync(otpauthUrl, ct);

        return new PlatformMfaSetupResponse(secret.Base32, otpauthUrl, qrCodeDataUrl);
    }

    private static string BuildOtpauthUrl(string email, string secret)
    {
        var label = Uri.EscapeDataString($"{Issuer}:{email}");
        return $"otpauth://totp/{label}?secret={secret}&issuer={Uri.EscapeDataString(Issuer)}";
    }

    /// <summary>
    /// Phase 1 placeholder: returns an SVG that displays the secret so user can
    /// type it into Google Authenticator / 1Password manually. Phase 2 sẽ thay
    /// bằng QRCoder (hoặc lib tương đương) để sinh QR data URL thật.
    /// </summary>
    private static Task<string> QrCodeDataUrlAsync(string content, CancellationToken ct)
    {
        var secret = content.Split("secret=")[1].Split('&')[0];
        var svg =
            "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='80'>" +
            "<rect width='240' height='80' fill='white' stroke='black'/>" +
            "<text x='10' y='25' font-size='11' font-family='monospace' fill='black'>QR placeholder (Phase 2)</text>" +
            $"<text x='10' y='50' font-size='14' font-weight='bold' font-family='monospace' fill='black'>Secret: {secret}</text>" +
            "<text x='10' y='68' font-size='8' fill='gray'>Type secret manually into authenticator app</text>" +
            "</svg>";
        var dataUrl = "data:image/svg+xml;utf8," + Uri.EscapeDataString(svg);
        return Task.FromResult(dataUrl);
    }
}
