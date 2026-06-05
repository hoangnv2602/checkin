using MediatR;

namespace SaasCheckin.Application.Common;

/// <summary>
/// Marker cho request cần permission check. <c>PermissionBehavior</c>
/// reject nếu current user thiếu 1 trong <see cref="RequiredPermissions"/>.
/// </summary>
public interface IRequirePermission
{
    IReadOnlyList<string> RequiredPermissions { get; }
}

public interface ICommand<TResponse> : IRequest<TResponse>, IRequirePermission
{
}

public interface IQuery<TResponse> : IRequest<TResponse>
{
}
