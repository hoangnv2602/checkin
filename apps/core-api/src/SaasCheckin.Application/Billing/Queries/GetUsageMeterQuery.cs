using MediatR;
using SaasCheckin.Domain.Billing.Repositories;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.Registration.Repositories;

namespace SaasCheckin.Application.Billing.Queries;

public sealed record GetUsageMeterQuery(Guid OrganizationId) : IRequest<UsageMeterDto>;

public sealed record UsageMeterDto(
    int ActiveEvents,
    int AttendeesThisMonth,
    int StaffSeats,
    int MaxActiveEvents,
    int MaxAttendeesPerMonth,
    int MaxStaffSeats);
