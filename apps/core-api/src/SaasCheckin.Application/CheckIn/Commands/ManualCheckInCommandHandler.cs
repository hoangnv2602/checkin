using MediatR;
using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.Events;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.CheckIn.Specifications;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.CheckIn.Commands;

public sealed class ManualCheckInCommandHandler : IRequestHandler<ManualCheckInCommand, ScanQrResult>
{
    private readonly IEventRepository _events;
    private readonly IRegistrationRepository _registrations;
    private readonly ICheckInRecordRepository _records;
    private readonly CanCheckInSpecification _canCheckIn;
    private readonly IIntegrationEventBus _bus;
    private readonly SaasCheckin.Application.CheckIn.Commands.ICheckInCache _cache;
    private readonly IClock _clock;

    public ManualCheckInCommandHandler(
        IEventRepository events,
        IRegistrationRepository registrations,
        ICheckInRecordRepository records,
        CanCheckInSpecification canCheckIn,
        IIntegrationEventBus bus,
        SaasCheckin.Application.CheckIn.Commands.ICheckInCache cache,
        IClock clock)
    {
        _events = events;
        _registrations = registrations;
        _records = records;
        _canCheckIn = canCheckIn;
        _bus = bus;
        _cache = cache;
        _clock = clock;
    }

    public async Task<ScanQrResult> Handle(ManualCheckInCommand cmd, CancellationToken ct)
    {
        var matches = await _registrations.ListByEmailAsync(
            cmd.AttendeeEmail, cmd.OrganizationId, 0, 5, ct);
        var registration = matches.FirstOrDefault(r => r.EventId == cmd.EventId)
            ?? throw new InvalidOperationException($"No registration for {cmd.AttendeeEmail} in this event");

        var @event = await _events.FindByIdAsync(
            EventId.From(cmd.EventId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException("Event not found");

        var existingSuccess = await _records.ListSuccessByRegistrationAsync(
            registration.Id.Value, cmd.OrganizationId, ct);

        if (!_canCheckIn.IsSatisfiedBy(@event, registration, existingSuccess, _clock.UtcNow))
        {
            CheckInRecord rec = existingSuccess.Count > 0
                ? CheckInRecord.Duplicate(cmd.OrganizationId, cmd.EventId, registration.Id.Value, registration.Jti,
                    GateId.From(cmd.GateId), cmd.StaffUserId, _clock.UtcNow, _clock)
                : CheckInRecord.Rejected(cmd.OrganizationId, cmd.EventId, registration.Id.Value, registration.Jti,
                    GateId.From(cmd.GateId), cmd.StaffUserId, "Cannot check in", _clock.UtcNow, _clock);
            await _records.AddAsync(rec, ct);
            return new ScanQrResult(rec.Id.Value, rec.Status, rec.RejectReason, registration.Jti, registration.AttendeeName);
        }

        var success = CheckInRecord.Success(
            cmd.OrganizationId, cmd.EventId, registration.Id.Value, registration.Jti,
            GateId.From(cmd.GateId), cmd.StaffUserId, _clock.UtcNow, _clock);
        await _records.AddAsync(success, ct);
        registration.MarkCheckedIn(_clock);
        await _registrations.UpdateAsync(registration, ct);
        await _cache.IncrementCheckInCountAsync(cmd.EventId, cmd.OrganizationId, ct);
        await _bus.PublishAsync(new AttendeeCheckedInIntegrationEvent(
            registration.Id.Value, registration.Jti, cmd.OrganizationId, cmd.EventId,
            cmd.GateId, cmd.StaffUserId, _clock.UtcNow), ct);
        return new ScanQrResult(success.Id.Value, CheckInStatus.Success, null, registration.Jti, registration.AttendeeName);
    }
}
