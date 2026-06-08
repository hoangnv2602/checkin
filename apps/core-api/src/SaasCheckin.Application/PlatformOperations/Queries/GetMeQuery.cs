using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;

namespace SaasCheckin.Application.PlatformOperations.Queries;

/// <summary>
/// Get current platform user. Used by BFF's /v1/admin/auth/me endpoint.
/// Caller supplies the userId (extracted from verified JWT in the controller).
/// </summary>
public sealed record GetMeQuery(Guid UserId) : IQuery<PlatformMeDto>;
