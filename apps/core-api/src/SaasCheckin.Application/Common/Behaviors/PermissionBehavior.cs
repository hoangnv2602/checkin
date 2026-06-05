using MediatR;
using SaasCheckin.Shared.Application.Authorization;

namespace SaasCheckin.Application.Common.Behaviors;

/// <summary>
/// Authoritative authz check (ADR-0015 §6). BFF chỉ verify JWT signature +
/// audience; mọi permission enforcement phải ở đây.
///
/// Order: chạy SAU ValidationBehavior, SAU LoggingBehavior, TRƯỚC handler.
/// </summary>
public sealed class PermissionBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequirePermission
{
    private readonly IPermissionChecker _checker;

    public PermissionBehavior(IPermissionChecker checker)
    {
        _checker = checker;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request.RequiredPermissions.Count > 0)
            _checker.EnsureAll(request.RequiredPermissions.ToArray());

        return await next();
    }
}
