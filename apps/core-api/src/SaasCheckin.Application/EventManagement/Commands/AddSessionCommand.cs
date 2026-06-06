using MediatR;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.EventManagement.Commands;

public sealed record AddSessionCommand(
    Guid OrganizationId,
    Guid EventId,
    string Title,
    string? Description,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Capacity,
    Guid? VenueId) : IRequest<SessionId>;

public sealed class AddSessionCommandHandler
    : IRequestHandler<AddSessionCommand, SessionId>
{
    private readonly ISessionRepository _sessions;
    private readonly IEventRepository _events;
    private readonly IVenueRepository _venues;
    private readonly IClock _clock;

    public AddSessionCommandHandler(
        ISessionRepository sessions,
        IEventRepository events,
        IVenueRepository venues,
        IClock clock)
    {
        _sessions = sessions;
        _events = events;
        _venues = venues;
        _clock = clock;
    }

    public async Task<SessionId> Handle(AddSessionCommand cmd, CancellationToken ct)
    {
        // Validate parent event tồn tại trong cùng tenant
        var parentEvent = await _events.FindByIdAsync(EventId.From(cmd.EventId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException($"Event {cmd.EventId} not found");

        // Validate venue nếu có
        VenueId? venueId = null;
        if (cmd.VenueId.HasValue)
        {
            var venue = await _venues.FindByIdAsync(VenueId.From(cmd.VenueId.Value), cmd.OrganizationId, ct)
                ?? throw new InvalidOperationException($"Venue {cmd.VenueId} not found");
            venueId = venue.Id;
        }

        // Session start/end phải nằm trong event period
        if (cmd.StartAt < parentEvent.Period.StartAt || cmd.EndAt > parentEvent.Period.EndAt)
            throw new InvalidOperationException(
                $"Session period [{cmd.StartAt:O}..{cmd.EndAt:O}) phải nằm trong event period");

        var session = Session.Create(
            cmd.OrganizationId,
            parentEvent.Id,
            cmd.Title,
            cmd.Description,
            EventPeriod.Create(cmd.StartAt, cmd.EndAt),
            Capacity.Create(cmd.Capacity),
            venueId,
            _clock);
        await _sessions.AddAsync(session, ct);
        return session.Id;
    }
}
