using Grpc.Core;
using MediatR;
using Microsoft.Extensions.Logging;
using SaasCheckin.Application.Identity.Commands;
using SaasCheckin.Application.Identity.Queries;
using SaasCheckin.Shared.Application.Tenancy;

namespace SaasCheckin.HttpApi.Host.Grpc;

/// <summary>
/// Identity gRPC service. BFF (NestJS api-gateway) gọi tới đây để
/// signin / refresh / get user. Tenant context đến qua metadata
/// <c>x-tenant-id</c> — middleware <c>CurrentTenantMiddleware</c> (filter)
/// set <c>ICurrentTenant</c> trước khi handler chạy.
///
/// Phase 1: dùng raw message types (POCOs) thay vì proto-generated. Sau khi
/// <c>buf generate</c> chạy, sẽ thay bằng generated types (Phase 1+2 task).
/// </summary>
public sealed class IdentityGrpcService
{
    private readonly IMediator _mediator;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<IdentityGrpcService> _logger;

    public IdentityGrpcService(
        IMediator mediator,
        ICurrentTenant currentTenant,
        ILogger<IdentityGrpcService> logger)
    {
        _mediator = mediator;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public async Task<SignInUserResponse> SignInUser(
        SignInUserRequest request,
        ServerCallContext context)
    {
        try
        {
            var result = await _mediator.Send(new LoginCommand(request.Email, request.Password), context.CancellationToken);
            return new SignInUserResponse
            {
                UserId = result.UserId.ToString(),
                AccessToken = result.AccessToken,
                AccessExpiresAt = result.AccessExpiresAt.ToString("O"),
                RefreshToken = result.RefreshToken,
                RefreshExpiresAt = result.RefreshExpiresAt.ToString("O"),
            };
        }
        catch (UnauthorizedAccessException ex)
        {
            throw new RpcException(new Status(StatusCode.Unauthenticated, ex.Message));
        }
    }

    public async Task<RefreshUserResponse> RefreshUser(
        RefreshUserRequest request,
        ServerCallContext context)
    {
        try
        {
            var result = await _mediator.Send(new RefreshTokenCommand(request.RefreshToken), context.CancellationToken);
            return new RefreshUserResponse
            {
                AccessToken = result.AccessToken,
                AccessExpiresAt = result.AccessExpiresAt.ToString("O"),
                RefreshToken = result.RefreshToken,
                RefreshExpiresAt = result.RefreshExpiresAt.ToString("O"),
            };
        }
        catch (UnauthorizedAccessException ex)
        {
            throw new RpcException(new Status(StatusCode.Unauthenticated, ex.Message));
        }
    }

    public async Task<LogoutUserResponse> LogoutUser(
        LogoutUserRequest request,
        ServerCallContext context)
    {
        await _mediator.Send(new LogoutCommand(request.RefreshToken), context.CancellationToken);
        return new LogoutUserResponse { Success = true };
    }

    public async Task<RegisterUserResponse> RegisterUser(
        RegisterUserRequest request,
        ServerCallContext context)
    {
        var result = await _mediator.Send(new RegisterUserCommand(
            request.Email,
            request.FullName,
            request.Password,
            request.OrganizationName,
            request.OrganizationSlug,
            request.DefaultLocale,
            request.DefaultCurrency,
            request.Timezone), context.CancellationToken);

        return new RegisterUserResponse
        {
            UserId = result.UserId.ToString(),
            OrganizationId = result.OrganizationId.ToString(),
            AccessToken = result.AccessToken,
            AccessExpiresAt = result.AccessExpiresAt.ToString("O"),
            RefreshToken = result.RefreshToken,
            RefreshExpiresAt = result.RefreshExpiresAt.ToString("O"),
        };
    }

    public async Task<GetUserResponse> GetUser(
        GetUserRequest request,
        ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid user_id"));

        var dto = await _mediator.Send(new GetUserQuery(userId), context.CancellationToken);
        return new GetUserResponse
        {
            UserId = dto.Id.ToString(),
            Email = dto.Email,
            FullName = dto.FullName,
            EmailVerified = dto.EmailVerified,
            LastLoginAt = dto.LastLoginAt?.ToString("O") ?? string.Empty,
        };
    }
}

// ----- Raw message types (Phase 1 stand-in cho proto-generated) -----
// Sau khi `buf generate` chạy (I-105), sẽ thay bằng generated types.

public class SignInUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class SignInUserResponse
{
    public string UserId { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public string AccessExpiresAt { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string RefreshExpiresAt { get; set; } = string.Empty;
}

public class RefreshUserRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class RefreshUserResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string AccessExpiresAt { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string RefreshExpiresAt { get; set; } = string.Empty;
}

public class LogoutUserRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class LogoutUserResponse
{
    public bool Success { get; set; }
}

public class RegisterUserRequest
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string OrganizationName { get; set; } = string.Empty;
    public string OrganizationSlug { get; set; } = string.Empty;
    public string? DefaultLocale { get; set; }
    public string? DefaultCurrency { get; set; }
    public string? Timezone { get; set; }
}

public class RegisterUserResponse
{
    public string UserId { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public string AccessExpiresAt { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string RefreshExpiresAt { get; set; } = string.Empty;
}

public class GetUserRequest
{
    public string UserId { get; set; } = string.Empty;
}

public class GetUserResponse
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public string LastLoginAt { get; set; } = string.Empty;
}
