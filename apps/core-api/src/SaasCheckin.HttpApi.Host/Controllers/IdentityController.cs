using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.Identity.Commands;
using SaasCheckin.Application.Identity.Queries;

namespace SaasCheckin.HttpApi.Host.Controllers;

/// <summary>
/// Identity REST controller — mirror của gRPC service, dùng cho:
/// - Playwright e2e test (HTTP dễ hơn gRPC)
/// - Internal admin scripts
/// - Health probe chi tiết
///
/// BFF (api-gateway) vẫn gọi qua gRPC. Controller này CHỈ accessible từ
/// internal network (chưa có auth filter Phase 1, sẽ thêm ở Phase 1+).
/// </summary>
[ApiController]
[Route("v1/identity")]
public sealed class IdentityController : ControllerBase
{
    private readonly IMediator _mediator;

    public IdentityController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(new RegisterUserCommand(
                dto.Email, dto.FullName, dto.Password,
                dto.OrganizationName, dto.OrganizationSlug,
                dto.DefaultLocale, dto.DefaultCurrency, dto.Timezone), ct);
            return Ok(result);
        }
        catch (SaasCheckin.Shared.Domain.Core.BusinessRuleViolationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(new LoginCommand(dto.Email, dto.Password), ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequestDto dto, CancellationToken ct)
    {
        try
        {
            var result = await _mediator.Send(new RefreshTokenCommand(dto.RefreshToken), ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequestDto dto, CancellationToken ct)
    {
        await _mediator.Send(new LogoutCommand(dto.RefreshToken), ct);
        return NoContent();
    }

    [HttpGet("users/{userId:guid}")]
    public async Task<IActionResult> GetUser(Guid userId, CancellationToken ct)
    {
        try
        {
            var dto = await _mediator.Send(new GetUserQuery(userId), ct);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}

public sealed record RegisterRequestDto(
    string Email, string FullName, string Password,
    string OrganizationName, string OrganizationSlug,
    string? DefaultLocale, string? DefaultCurrency, string? Timezone);

public sealed record LoginRequestDto(string Email, string Password);
public sealed record RefreshRequestDto(string RefreshToken);
public sealed record LogoutRequestDto(string RefreshToken);
