using MediatR;
using SaasCheckin.Application.Common;
using SaasCheckin.Application.PlatformOperations.Dtos;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;

namespace SaasCheckin.Application.PlatformOperations.Queries;

public sealed class GetMeQueryHandler : IRequestHandler<GetMeQuery, PlatformMeDto>
{
    private readonly IPlatformUserRepository _users;

    public GetMeQueryHandler(IPlatformUserRepository users)
    {
        _users = users;
    }

    public async Task<PlatformMeDto> Handle(GetMeQuery query, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(PlatformUserId.From(query.UserId), ct)
            ?? throw new KeyNotFoundException($"PlatformUser {query.UserId} không tồn tại.");

        return new PlatformMeDto(
            user.Id.Value,
            user.Email.Value,
            user.FullName,
            user.Role.ToString(),
            user.MfaEnabled);
    }
}
