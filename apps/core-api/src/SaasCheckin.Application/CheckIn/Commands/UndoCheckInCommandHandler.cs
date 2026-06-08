using MediatR;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Application.CheckIn.Commands;

public sealed class UndoCheckInCommandHandler : IRequestHandler<UndoCheckInCommand>
{
    private readonly ICheckInRecordRepository _records;
    private readonly IRegistrationRepository _registrations;
    private readonly IClock _clock;

    public UndoCheckInCommandHandler(
        ICheckInRecordRepository records,
        IRegistrationRepository registrations,
        IClock clock)
    {
        _records = records;
        _registrations = registrations;
        _clock = clock;
    }

    public async Task Handle(UndoCheckInCommand cmd, CancellationToken ct)
    {
        var rec = await _records.FindByIdAsync(
            Domain.CheckIn.ValueObjects.CheckInRecordId.From(cmd.CheckInRecordId),
            cmd.OrganizationId, ct) ?? throw new InvalidOperationException("CheckIn record not found");

        if (rec.Status != Domain.CheckIn.ValueObjects.CheckInStatus.Success)
            throw new InvalidOperationException("Only successful check-ins can be undone");

        var registration = await _registrations.FindByIdAsync(
            Domain.Registration.ValueObjects.RegistrationId.From(rec.RegistrationId),
            cmd.OrganizationId, ct) ?? throw new InvalidOperationException("Registration not found");

        // Phase 4 stub: tạo Rejected audit row với reason
        var revert = Domain.CheckIn.Aggregates.CheckInRecord.Rejected(
            rec.OrganizationId, rec.EventId, rec.RegistrationId, rec.Jti,
            rec.GateId, cmd.StaffUserId, $"UNDO: {cmd.Reason}", _clock.UtcNow, _clock);
        await _records.AddAsync(revert, ct);

        // Reset registration về Active
        // Phase 4 simple: chỉ emit log. Phase 5: thêm UndoCheckIn event + handler.
        _ = registration; // suppress unused
    }
}
