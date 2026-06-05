using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.CheckIn.Aggregates;
using SaasCheckin.Domain.CheckIn.Repositories;
using SaasCheckin.Domain.CheckIn.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.EntityFrameworkCore.CheckIn.Repositories;

public sealed class CheckInRecordRepository : ICheckInRecordRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly IClock _clock;

    public CheckInRecordRepository(SaasCheckinDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<CheckInRecord?> FindByIdAsync(CheckInRecordId id, Guid organizationId, CancellationToken ct = default)
    {
        var e = await _db.Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id.Value && x.TenantId == organizationId, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<IReadOnlyList<CheckInRecord>> ListByEventAsync(
        Guid eventId, Guid organizationId, DateTimeOffset? since, int skip, int take, CancellationToken ct = default)
    {
        var q = _db.Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>()
            .AsNoTracking()
            .Where(x => x.EventId == eventId && x.TenantId == organizationId);
        if (since.HasValue) q = q.Where(x => x.ScannedAt >= since.Value);
        var rows = await q.OrderByDescending(x => x.ScannedAt).Skip(skip).Take(take).ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public async Task<IReadOnlyList<CheckInRecord>> ListSuccessByRegistrationAsync(
        Guid registrationId, Guid organizationId, CancellationToken ct = default)
    {
        var rows = await _db.Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>()
            .AsNoTracking()
            .Where(x => x.RegistrationId == registrationId
                && x.TenantId == organizationId
                && x.Status == (int)CheckInStatus.Success)
            .ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public Task<int> CountSuccessByEventAsync(Guid eventId, Guid organizationId, CancellationToken ct = default) =>
        _db.Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>()
            .AsNoTracking()
            .CountAsync(x => x.EventId == eventId
                && x.TenantId == organizationId
                && x.Status == (int)CheckInStatus.Success, ct);

    public Task<int> CountRejectedByEventAsync(Guid eventId, Guid organizationId, CancellationToken ct = default) =>
        _db.Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>()
            .AsNoTracking()
            .CountAsync(x => x.EventId == eventId
                && x.TenantId == organizationId
                && x.Status == (int)CheckInStatus.Rejected, ct);

    public async Task AddAsync(CheckInRecord record, CancellationToken ct = default)
    {
        _db.Set<CheckInRecordEntityConfiguration.CheckInRecordEntity>().Add(MapToEntity(record));
        await _db.SaveChangesAsync(ct);
    }

    private CheckInRecord MapToDomain(CheckInRecordEntityConfiguration.CheckInRecordEntity e)
    {
        return e.Status switch
        {
            (int)CheckInStatus.Success => CheckInRecord.Success(
                e.TenantId, e.EventId, e.RegistrationId, e.Jti,
                GateId.From(e.GateId), e.StaffUserId, e.ScannedAt, _clock),
            (int)CheckInStatus.Duplicate => CheckInRecord.Duplicate(
                e.TenantId, e.EventId, e.RegistrationId, e.Jti,
                GateId.From(e.GateId), e.StaffUserId, e.ScannedAt, _clock),
            _ => CheckInRecord.Rejected(
                e.TenantId, e.EventId, e.RegistrationId, e.Jti,
                GateId.From(e.GateId), e.StaffUserId, e.RejectReason ?? "Unknown", e.ScannedAt, _clock),
        };
    }

    private CheckInRecordEntityConfiguration.CheckInRecordEntity MapToEntity(CheckInRecord r) => new()
    {
        Id = r.Id.Value,
        TenantId = r.OrganizationId,
        EventId = r.EventId,
        RegistrationId = r.RegistrationId,
        Jti = r.Jti,
        GateId = r.GateId.Value,
        StaffUserId = r.StaffUserId,
        Status = (int)r.Status,
        RejectReason = r.RejectReason,
        ScannedAt = r.ScannedAt,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };
}
