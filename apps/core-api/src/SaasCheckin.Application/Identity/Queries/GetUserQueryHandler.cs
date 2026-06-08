using MediatR;
using SaasCheckin.Application.Identity.Dtos;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Repositories;
using SaasCheckin.Domain.Identity.ValueObjects;

namespace SaasCheckin.Application.Identity.Queries;

public sealed class GetUserQueryHandler : IRequestHandler<GetUserQuery, UserDto>
{
    private readonly IUserRepository _users;

    public GetUserQueryHandler(IUserRepository users)
    {
        _users = users;
    }

    public async Task<UserDto> Handle(GetUserQuery query, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(UserId.From(query.UserId), ct)
            ?? throw new KeyNotFoundException($"User {query.UserId} không tồn tại.");

        return new UserDto(
            user.Id.Value,
            user.Email.Value,
            user.FullName.Value,
            user.EmailVerifiedAt.HasValue,
            user.LastLoginAt);
    }
}
