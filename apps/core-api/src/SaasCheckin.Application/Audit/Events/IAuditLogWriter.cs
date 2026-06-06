// apps/core-api/src/SaasCheckin.Application/Audit/Events/IAuditLogWriter.cs
//
// I-602 — AuditLogService. INSERT-only qua role DB (REVOKE UPDATE, DELETE).
// Mọi mutation trong hệ thống phải log vào đây với actor + action + entity.
namespace SaasCheckin.Application.Audit.Events;

public interface IAuditLogWriter
{
    Task WriteAsync(AuditLogEntry entry, CancellationToken ct = default);
}

public sealed record AuditLogEntry(
    Guid OrganizationId,
    Guid ActorUserId,
    string ActorRole,
    string Action,
    string EntityType,
    string EntityId,
    string? MetadataJson = null,
    string? IpAddress = null,
    string? UserAgent = null);
