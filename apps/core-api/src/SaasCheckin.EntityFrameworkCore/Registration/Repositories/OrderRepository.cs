using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.Registration.Aggregates;
using SaasCheckin.Domain.Registration.Repositories;
using SaasCheckin.Domain.Registration.ValueObjects;
using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.EntityFrameworkCore.Registration.Repositories;

public sealed class OrderRepository : IOrderRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly IClock _clock;

    public OrderRepository(SaasCheckinDbContext db, IClock clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<Order?> FindByIdAsync(OrderId id, Guid organizationId, CancellationToken ct = default)
    {
        var e = await _db.Set<OrderEntityConfiguration.OrderEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id.Value && x.TenantId == organizationId, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<Order?> FindByProviderSessionAsync(string providerSessionId, CancellationToken ct = default)
    {
        var e = await _db.Set<OrderEntityConfiguration.OrderEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.ProviderSessionId == providerSessionId, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<IReadOnlyList<Order>> ListByEventAsync(Guid eventId, Guid organizationId, int skip, int take, CancellationToken ct = default)
    {
        var rows = await _db.Set<OrderEntityConfiguration.OrderEntity>()
            .AsNoTracking()
            .Where(x => x.EventId == eventId && x.TenantId == organizationId)
            .OrderByDescending(x => x.CreatedAt)
            .Skip(skip).Take(take)
            .ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public async Task<IReadOnlyList<Order>> ListPendingExpiredAsync(DateTimeOffset cutoff, int take, CancellationToken ct = default)
    {
        var rows = await _db.Set<OrderEntityConfiguration.OrderEntity>()
            .AsNoTracking()
            .Where(x => x.Status == 0 && x.ExpiresAt < cutoff)
            .OrderBy(x => x.ExpiresAt)
            .Take(take)
            .ToListAsync(ct);
        return rows.Select(MapToDomain).ToList();
    }

    public async Task AddAsync(Order order, CancellationToken ct = default)
    {
        _db.Set<OrderEntityConfiguration.OrderEntity>().Add(MapToEntity(order));
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Order order, CancellationToken ct = default)
    {
        _db.Set<OrderEntityConfiguration.OrderEntity>().Update(MapToEntity(order));
        await _db.SaveChangesAsync(ct);
    }

    private Order MapToDomain(OrderEntityConfiguration.OrderEntity e) => Order.Create(
        e.TenantId, e.EventId, e.TicketTypeId, e.Quantity,
        e.BuyerEmail, e.BuyerName,
        Money.Of(e.SubtotalAmountMinor, e.Currency),
        Money.Of(e.DiscountAmountMinor, e.Currency),
        Money.Of(e.TotalAmountMinor, e.Currency),
        e.DiscountCode,
        Enum.Parse<PaymentProvider>(e.Provider, ignoreCase: true),
        TimeSpan.FromMinutes(10), _clock);

    private OrderEntityConfiguration.OrderEntity MapToEntity(Order o) => new()
    {
        Id = o.Id.Value,
        TenantId = o.OrganizationId,
        EventId = o.EventId,
        TicketTypeId = o.TicketTypeId,
        Quantity = o.Quantity,
        BuyerEmail = o.BuyerEmail,
        BuyerName = o.BuyerName,
        SubtotalAmountMinor = o.Subtotal.AmountMinor,
        DiscountAmountMinor = o.Discount.AmountMinor,
        TotalAmountMinor = o.Total.AmountMinor,
        Currency = o.Total.Currency,
        DiscountCode = o.DiscountCode,
        Provider = o.Provider.ToString().ToLowerInvariant(),
        ProviderSessionId = o.ProviderSessionId,
        Status = (int)o.Status,
        ExpiresAt = o.ExpiresAt,
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt
    };
}
