using SaasCheckin.Domain.Identity.ValueObjects;
using SaasCheckin.Shared.Application.IntegrationEvents;  // IIntegrationEvent marker (Phase 1 stub)

namespace SaasCheckin.Domain.Identity.Events;

/// <summary>
/// Integration event: Organization vừa được tạo — publish cho bounded context khác
/// (Billing tạo subscription trial, Notification tạo default templates, ...).
///
/// Phase 1: in-process only (no broker). Phase 2+ publish qua MassTransit + RabbitMQ.
/// </summary>
public sealed record OrgCreatedIntegrationEvent(
    OrganizationId OrganizationId,
    string Name,
    string Slug,
    string DefaultCurrency,
    DateTimeOffset OccurredAt
) : IIntegrationEvent;
