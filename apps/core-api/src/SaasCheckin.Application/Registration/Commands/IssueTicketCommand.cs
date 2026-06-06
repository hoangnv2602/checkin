using MediatR;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.Services;
using SaasCheckin.Shared.Domain.Core;
using RegistrationEntity = SaasCheckin.Domain.Registration.Aggregates.Registration;

namespace SaasCheckin.Application.Registration.Commands;

/// <summary>
/// IssueTicketCommand — issue 1 ticket cho attendee. Thường được gọi tự động
/// từ MarkOrderPaidCommandHandler; expose riêng cho test + manual reissue.
/// </summary>
public sealed record IssueTicketCommand(
    Guid OrganizationId,
    Guid OrderId,
    string AttendeeEmail,
    string AttendeeName,
    string? AttendeePhone) : IRequest<Guid>;

public sealed class IssueTicketCommandHandler
    : IRequestHandler<IssueTicketCommand, Guid>
{
    private static readonly TimeSpan TicketValidity = TimeSpan.FromDays(1);

    private readonly IOrderRepository _orders;
    private readonly IRegistrationRepository _registrations;
    private readonly IQrCodeGenerator _qr;
    private readonly IClock _clock;

    public IssueTicketCommandHandler(
        IOrderRepository orders,
        IRegistrationRepository registrations,
        IQrCodeGenerator qr,
        IClock clock)
    {
        _orders = orders;
        _registrations = registrations;
        _qr = qr;
        _clock = clock;
    }

    public async Task<Guid> Handle(IssueTicketCommand cmd, CancellationToken ct)
    {
        var order = await _orders.FindByIdAsync(
            Domain.Registration.ValueObjects.OrderId.From(cmd.OrderId),
            cmd.OrganizationId, ct) ?? throw new InvalidOperationException("Order not found");

        if (order.Status != OrderStatus.Paid)
            throw new InvalidOperationException($"Cannot issue ticket for order in status {order.Status}");

        var reg = RegistrationEntity.Issue(
            order.OrganizationId, order.EventId, order.Id, order.TicketTypeId,
            cmd.AttendeeEmail, cmd.AttendeeName, cmd.AttendeePhone,
            TicketValidity, _clock);

        // Pre-sign payload so worker can render image from signed bytes.
        var payload = reg.ToQrPayload();
        var signature = _qr.Sign(payload, reg.OrganizationId);
        reg.AttachQrImage(
            qrImageUrl: $"pending://{reg.Jti}",
            signature: Convert.ToBase64String(signature.Value),
            _clock);

        await _registrations.AddAsync(reg, ct);
        return reg.Id;
    }
}
