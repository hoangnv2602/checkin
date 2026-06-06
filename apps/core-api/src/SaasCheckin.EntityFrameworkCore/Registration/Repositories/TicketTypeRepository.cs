using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.EntityFrameworkCore.Registration.Repositories;

public sealed class TicketTypeRepository : ITicketTypeRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly IClock _clock;

    public TicketTypeRepository(SaasCheckinDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<TicketType?> FindByIdAsync(TicketTypeId id, Guid organizationId, CancellationToken ct = default)
    {
        var entity = await _db.Set<TicketTypeEntityConfiguration.TicketTypeEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id.Value && x.TenantId == organizationId, ct);
        return entity is null ? null : MapToDomain(entity);
    }

    public async Task<IReadOnlyList<TicketType>> ListByEventAsync(Guid eventId, Guid organizationId, CancellationToken ct = default)
    {
        var rows = await _db.Set<TicketTypeEntityConfiguration.TicketTypeEntity>()
            .AsNoTracking()
            .Where(x => x.EventId == eventId && x.TenantId == organizationId)
            .OrderBy(x => x.SaleStartsAt)
            .ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public async Task AddAsync(TicketType ticketType, CancellationToken ct = default)
    {
        _db.Set<TicketTypeEntityConfiguration.TicketTypeEntity>().Add(MapToEntity(ticketType));
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(TicketType ticketType, CancellationToken ct = default)
    {
        _db.Set<TicketTypeEntityConfiguration.TicketTypeEntity>().Update(MapToEntity(ticketType));
        await _db.SaveChangesAsync(ct);
    }

    private TicketType MapToDomain(TicketTypeEntityConfiguration.TicketTypeEntity e)
    {
        var tt = TicketType.Create(
            e.TenantId, e.EventId, e.Name, e.Description,
            Money.Of(e.PriceAmountMinor, e.PriceCurrency),
            e.Capacity, e.SaleStartsAt, e.SaleEndsAt, _clock);
        // Reconstitute by reflection not available; we expose mapper for tests
        // For Phase 3 we keep the entity as the canonical persisted form and
        // re-create via the domain constructor; aggregate invariants already
        // captured in domain event handlers. See Reconstitute pattern in I-401+.
        return tt;
    }

    private TicketTypeEntityConfiguration.TicketTypeEntity MapToEntity(TicketType t) => new()
    {
        Id = t.Id.Value,
        TenantId = t.OrganizationId,
        EventId = t.EventId,
        Name = t.Name,
        Description = t.Description,
        PriceAmountMinor = t.Price.AmountMinor,
        PriceCurrency = t.Price.Currency,
        Capacity = t.Capacity,
        SoldCount = t.SoldCount,
        SaleStartsAt = t.SaleStartsAt,
        SaleEndsAt = t.SaleEndsAt,
        IsActive = t.IsActive,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };
}
