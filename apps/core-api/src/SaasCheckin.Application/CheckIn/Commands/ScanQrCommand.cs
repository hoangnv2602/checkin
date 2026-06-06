using MediatR;
using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.Events;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.CheckIn.Services;
using SaasCheckin.Domain.CheckIn.Specifications;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Domain.EventManagement.Repositories;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.CheckIn.Commands;

public sealed record ScanQrCommand(
    Guid OrganizationId,
    Guid EventId,
    Guid GateId,
    Guid StaffUserId,
    Guid Jti,
    Guid RegistrationId,
    string SignatureBase64) : IRequest<ScanQrResult>;

public sealed record ScanQrResult(
    Guid CheckInRecordId,
    CheckInStatus Status,
    string? RejectReason,
    Guid? Jti,
    string? AttendeeName);

public sealed class ScanQrCommandHandler : IRequestHandler<ScanQrCommand, ScanQrResult>
{
    private readonly IEventRepository _events;
    private readonly IRegistrationRepository _registrations;
    private readonly ICheckInRecordRepository _records;
    private readonly IQrSignatureVerifier _verifier;
    private readonly CanCheckInSpecification _canCheckIn;
    private readonly IIntegrationEventBus _bus;
    private readonly ICheckInCache _cache;
    private readonly IClock _clock;

    public ScanQrCommandHandler(
        IEventRepository events,
        IRegistrationRepository registrations,
        ICheckInRecordRepository records,
        IQrSignatureVerifier verifier,
        CanCheckInSpecification canCheckIn,
        IIntegrationEventBus bus,
        ICheckInCache cache,
        IClock clock)
    {
        _events = events;
        _registrations = registrations;
        _records = records;
        _verifier = verifier;
        _canCheckIn = canCheckIn;
        _bus = bus;
        _cache = cache;
        _clock = clock;
    }

    public async Task<ScanQrResult> Handle(ScanQrCommand cmd, CancellationToken ct)
    {
        // 1. Verify signature
        var payload = new QrPayload(
            cmd.Jti, cmd.RegistrationId, cmd.EventId, cmd.OrganizationId,
            _clock.UtcNow, _clock.UtcNow.AddDays(1));
        byte[] sigBytes;
        try { sigBytes = Convert.FromBase64String(cmd.SignatureBase64); }
        catch { sigBytes = Array.Empty<byte>(); }
        var signature = sigBytes.Length == 64 ? new QrSignature(sigBytes) : default;

        if (sigBytes.Length != 64 || !_verifier.Verify(payload, signature, cmd.OrganizationId))
        {
            var rec = CheckInRecord.Rejected(
                cmd.OrganizationId, cmd.EventId, cmd.RegistrationId, cmd.Jti,
                GateId.From(cmd.GateId), cmd.StaffUserId, "Invalid signature",
                _clock.UtcNow, _clock);
            await _records.AddAsync(rec, ct);
            return new ScanQrResult(rec.Id.Value, CheckInStatus.Rejected, "Invalid signature", null, null);
        }

        // 2. Lookup event + registration
        var @event = await _events.FindByIdAsync(
            EventId.From(cmd.EventId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException("Event not found");
        var registration = await _registrations.FindByIdAsync(
            RegistrationId.From(cmd.RegistrationId), cmd.OrganizationId, ct)
            ?? throw new InvalidOperationException("Registration not found");

        // 3. Existing success?
        var existingSuccess = await _records.ListSuccessByRegistrationAsync(
            cmd.RegistrationId, cmd.OrganizationId, ct);

        // 4. Spec
        if (!_canCheckIn.IsSatisfiedBy(@event, registration, existingSuccess, _clock.UtcNow))
        {
            // Distinguish duplicate from other reasons
            CheckInRecord rec;
            if (existingSuccess.Count > 0)
            {
                rec = CheckInRecord.Duplicate(
                    cmd.OrganizationId, cmd.EventId, cmd.RegistrationId, cmd.Jti,
                    GateId.From(cmd.GateId), cmd.StaffUserId, _clock.UtcNow, _clock);
            }
            else
            {
                var reason = registration.Status != RegistrationStatus.Active
                    ? $"Registration is {registration.Status}"
                    : @event.Status != EventStatus.Published
                        ? "Event not published"
                        : "Outside event window";
                rec = CheckInRecord.Rejected(
                    cmd.OrganizationId, cmd.EventId, cmd.RegistrationId, cmd.Jti,
                    GateId.From(cmd.GateId), cmd.StaffUserId, reason, _clock.UtcNow, _clock);
            }
            await _records.AddAsync(rec, ct);
            return new ScanQrResult(rec.Id.Value, rec.Status, rec.RejectReason, registration.Jti, registration.AttendeeName);
        }

        // 5. Success
        var success = CheckInRecord.Success(
            cmd.OrganizationId, cmd.EventId, cmd.RegistrationId, cmd.Jti,
            GateId.From(cmd.GateId), cmd.StaffUserId, _clock.UtcNow, _clock);
        await _records.AddAsync(success, ct);

        // 6. Mark registration as CheckedIn + publish realtime
        registration.MarkCheckedIn(_clock);
        await _registrations.UpdateAsync(registration, ct);

        await _cache.IncrementCheckInCountAsync(cmd.EventId, cmd.OrganizationId, ct);

        await _bus.PublishAsync(new AttendeeCheckedInIntegrationEvent(
            cmd.RegistrationId, cmd.Jti, cmd.OrganizationId, cmd.EventId,
            cmd.GateId, cmd.StaffUserId, _clock.UtcNow), ct);

        return new ScanQrResult(success.Id.Value, CheckInStatus.Success, null, registration.Jti, registration.AttendeeName);
    }
}

public interface ICheckInCache
{
    Task IncrementCheckInCountAsync(Guid eventId, Guid organizationId, CancellationToken ct = default);
    Task<int?> GetCheckInCountAsync(Guid eventId, Guid organizationId, CancellationToken ct = default);
    Task SetStatusAsync(Guid registrationId, Guid organizationId, string status, CancellationToken ct = default);
    Task<string?> GetStatusAsync(Guid registrationId, Guid organizationId, CancellationToken ct = default);
}
