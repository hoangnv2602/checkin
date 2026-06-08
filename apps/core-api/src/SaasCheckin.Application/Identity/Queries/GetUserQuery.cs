using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.Identity.Dtos;

namespace SaasCheckin.Application.Identity.Queries;

public sealed record GetUserQuery(Guid UserId) : IQuery<UserDto>;
