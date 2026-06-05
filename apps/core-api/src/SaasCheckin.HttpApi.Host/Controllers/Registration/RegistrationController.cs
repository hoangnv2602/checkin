using MediatR;
using Microsoft.AspNetCore.Mvc;
using SaasCheckin.Application.Registration.Commands;

namespace SaasCheckin.HttpApi.Host.Controllers.Registration;

/// <summary>
/// Registration REST controller — public endpoints cho attendee flow.
/// Auth: không cần (public event pages). Tenant id từ URL path
/// (<c>orgSlug</c> → resolve sang organization_id qua Identity BC).
/// </summary>
[ApiController]
[Route("v1/registration")]
public sealed class RegistrationController : ControllerBase
{
    private readonly IMediator _mediator;

    public RegistrationController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>POST /v1/registration/ticket-types — organizer only.</summary>
    [HttpPost("ticket-types")]
    public async Task<IActionResult> CreateTicketType(
        [FromBody] CreateTicketTypeRequestDto dto,
        CancellationToken ct)
    {
        var id = await _mediator.Send(new CreateTicketTypeCommand(
            dto.OrganizationId, dto.EventId, dto.Name, dto.Description,
            dto.PriceAmountMinor, dto.PriceCurrency, dto.Capacity,
            dto.SaleStartsAt, dto.SaleEndsAt), ct);
        return Ok(new { id });
    }

    /// <summary>POST /v1/registration/orders — public; tạo order pending.</summary>
    [HttpPost("orders")]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequestDto dto,
        CancellationToken ct)
    {
        var result = await _mediator.Send(new CreateOrderCommand(
            dto.OrganizationId, dto.EventId, dto.TicketTypeId, dto.Quantity,
            dto.BuyerEmail, dto.BuyerName, dto.DiscountCode,
            Enum.Parse<Domain.Registration.ValueObjects.PaymentProvider>(dto.Provider, true)), ct);
        return Ok(new
        {
            order_id = result.OrderId,
            ticket_type_id = result.TicketTypeId,
            quantity = result.Quantity,
            subtotal_amount_minor = result.Subtotal.AmountMinor,
            subtotal_currency = result.Subtotal.Currency,
            discount_amount_minor = result.Discount.AmountMinor,
            total_amount_minor = result.Total.AmountMinor,
            total_currency = result.Total.Currency,
            discount_code = result.DiscountCode,
            expires_at = result.ExpiresAt
        });
    }

    /// <summary>POST /v1/registration/orders/{orderId}/attach-session — internal.</summary>
    [HttpPost("orders/{orderId:guid}/attach-session")]
    public async Task<IActionResult> AttachSession(
        Guid orderId,
        [FromBody] AttachSessionRequestDto dto,
        CancellationToken ct)
    {
        await _mediator.Send(new AttachProviderSessionCommand(
            dto.OrganizationId, orderId, dto.ProviderSessionId), ct);
        return Ok();
    }

    /// <summary>POST /v1/registration/orders/{orderId}/mark-paid — webhook entrypoint.</summary>
    [HttpPost("orders/{orderId:guid}/mark-paid")]
    public async Task<IActionResult> MarkPaid(
        Guid orderId,
        [FromBody] MarkPaidRequestDto dto,
        CancellationToken ct)
    {
        await _mediator.Send(new MarkOrderPaidCommand(
            dto.OrganizationId, orderId, dto.ProviderSessionId), ct);
        return Ok();
    }

    /// <summary>POST /v1/registration/apply-discount — public; preview trên form.</summary>
    [HttpPost("apply-discount")]
    public async Task<IActionResult> ApplyDiscount(
        [FromBody] ApplyDiscountRequestDto dto,
        CancellationToken ct)
    {
        var result = await _mediator.Send(new ApplyDiscountCommand(
            dto.OrganizationId, dto.EventId, dto.TicketTypeId, dto.Quantity, dto.DiscountCode), ct);
        return Ok(new
        {
            subtotal = new { result.Subtotal.AmountMinor, result.Subtotal.Currency },
            discount = new { result.Discount.AmountMinor, result.Discount.Currency },
            total = new { result.Total.AmountMinor, result.Total.Currency },
            applied_code = result.AppliedCode,
            failure_reason = result.FailureReason,
            valid = result.IsValid
        });
    }
}

public sealed record CreateTicketTypeRequestDto(
    Guid OrganizationId,
    Guid EventId,
    string Name,
    string? Description,
    long PriceAmountMinor,
    string PriceCurrency,
    int Capacity,
    DateTimeOffset SaleStartsAt,
    DateTimeOffset SaleEndsAt);

public sealed record CreateOrderRequestDto(
    Guid OrganizationId,
    Guid EventId,
    Guid TicketTypeId,
    int Quantity,
    string BuyerEmail,
    string BuyerName,
    string? DiscountCode,
    string Provider);

public sealed record AttachSessionRequestDto(Guid OrganizationId, string ProviderSessionId);

public sealed record MarkPaidRequestDto(Guid OrganizationId, string ProviderSessionId);

public sealed record ApplyDiscountRequestDto(
    Guid OrganizationId,
    Guid EventId,
    Guid TicketTypeId,
    int Quantity,
    string DiscountCode);
