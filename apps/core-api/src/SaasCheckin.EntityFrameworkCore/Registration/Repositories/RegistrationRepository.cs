using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.EntityFrameworkCore.Registration.Repositories;

public sealed class RegistrationRepository : IRegistrationRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly IClock _clock;

    public RegistrationRepository(SaasCheckinDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<Registration?> FindByIdAsync(RegistrationId id, Guid organizationId, CancellationToken ct = default)
    {
        var e = await _db.Set<RegistrationEntityConfiguration.RegistrationEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id.Value && x.TenantId == organizationId, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<Registration?> FindByJtiAsync(Guid jti, Guid organizationId, CancellationToken ct = default)
    {
        var e = await _db.Set<RegistrationEntityConfiguration.RegistrationEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Jti == jti && x.TenantId == organizationId, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<IReadOnlyList<Registration>> ListByOrderAsync(Guid orderId, Guid organizationId, CancellationToken ct = default)
    {
        var rows = await _db.Set<RegistrationEntityConfiguration.RegistrationEntity>()
            .AsNoTracking()
            .Where(x => x.OrderId == orderId && x.TenantId == organizationId)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public async Task<IReadOnlyList<Registration>> ListByEventAsync(Guid eventId, Guid organizationId, int skip, int take, CancellationToken ct = default)
    {
        var rows = await _db.Set<RegistrationEntityConfiguration.RegistrationEntity>()
            .AsNoTracking()
            .Where(x => x.EventId == eventId && x.TenantId == organizationId)
            .OrderByDescending(x => x.CreatedAt)
            .Skip(skip).Take(take)
            .ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public async Task<IReadOnlyList<Registration>> ListByEmailAsync(string email, Guid organizationId, int skip, int take, CancellationToken ct = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        var rows = await _db.Set<RegistrationEntityConfiguration.RegistrationEntity>()
            .AsNoTracking()
            .Where(x => x.AttendeeEmail == normalized && x.TenantId == organizationId)
            .OrderByDescending(x => x.CreatedAt)
            .Skip(skip).Take(take)
            .ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public async Task AddAsync(Registration registration, CancellationToken ct = default)
    {
        _db.Set<RegistrationEntityConfiguration.RegistrationEntity>().Add(MapToEntity(registration));
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Registration registration, CancellationToken ct = default)
    {
        _db.Set<RegistrationEntityConfiguration.RegistrationEntity>().Update(MapToEntity(registration));
        await _db.SaveChangesAsync(ct);
    }

    private Registration MapToDomain(RegistrationEntityConfiguration.RegistrationEntity e) =>
        Registration.Issue(
            e.TenantId, e.EventId, e.OrderId, e.TicketTypeId,
            e.AttendeeEmail, e.AttendeeName, e.AttendeePhone,
            e.ExpiresAt - e.IssuedAt, _clock);

    private RegistrationEntityConfiguration.RegistrationEntity MapToEntity(Registration r) => new()
    {
        Id = r.Id.Value,
        TenantId = r.OrganizationId,
        EventId = r.EventId,
        OrderId = r.OrderId,
        TicketTypeId = r.TicketTypeId,
        Jti = r.Jti,
        AttendeeEmail = r.AttendeeEmail,
        AttendeeName = r.AttendeeName,
        AttendeePhone = r.AttendeePhone,
        Status = (int)r.Status,
        IssuedAt = r.IssuedAt,
        ExpiresAt = r.ExpiresAt,
        CheckedInAt = r.CheckedInAt,
        QrImageUrl = r.QrImageUrl,
        Signature = r.Signature,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };
}
