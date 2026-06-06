using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;

namespace SaasCheckin.EntityFrameworkCore.PlatformOperations.Repositories;

public sealed class PlatformSessionRepository : IPlatformSessionRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly DbSet<PlatformSessionEntityConfiguration.PlatformSessionEntity> _table;

    public PlatformSessionRepository(SaasCheckinDbContext db)
    {
        _db = db;
        _table = db.Set<PlatformSessionEntityConfiguration.PlatformSessionEntity>();
    }

    public async Task<PlatformSession?> FindByIdAsync(PlatformSessionId id, CancellationToken ct = default)
    {
        var e = await _table.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id.Value, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<PlatformSession?> FindByRefreshTokenHashAsync(string hash, CancellationToken ct = default)
    {
        var e = await _table.AsNoTracking()
            .FirstOrDefaultAsync(x => x.RefreshTokenHash == hash, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task AddAsync(PlatformSession session, CancellationToken ct = default)
    {
        await _table.AddAsync(MapToEntity(session), ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(PlatformSession session, CancellationToken ct = default)
    {
        var entity = await _table.FirstOrDefaultAsync(x => x.Id == session.Id.Value, ct);
        if (entity is null)
        {
            await AddAsync(session, ct);
            return;
        }
        entity.RefreshTokenHash = session.RefreshTokenHash;
        entity.ExpiresAt = session.ExpiresAt;
        entity.RevokedAt = session.RevokedAt;
        entity.CreatedFromIp = session.CreatedFromIp;
        await _db.SaveChangesAsync(ct);
    }

    private static PlatformSession MapToDomain(PlatformSessionEntityConfiguration.PlatformSessionEntity e)
    {
        // Domain re-constitute — ctor (PlatformUserId, string refreshTokenHash, DateTimeOffset createdAt, expiresAt, string? fromIp)
        // 5 tham số. Id do base AggregateRoot cấp qua : base(PlatformSessionId.New()) — không nhận từ ctor.
        // Workaround: gọi factory Create() rồi overwrite Id (private setter).
        var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
        var session = PlatformSession.Create(
            PlatformUserId.From(e.UserId),
            e.RefreshTokenHash,
            TimeSpan.FromSeconds(Math.Max(1, (e.ExpiresAt - e.CreatedAt).TotalSeconds)),
            new Shared.Domain.Core.SystemClock(),
            e.CreatedFromIp);
        typeof(PlatformSession).GetProperty(nameof(PlatformSession.Id), flags)!.SetValue(session, PlatformSessionId.From(e.Id));
        typeof(PlatformSession).GetProperty(nameof(PlatformSession.RevokedAt), flags)!.SetValue(session, e.RevokedAt);
        return session;
    }

    private static PlatformSessionEntityConfiguration.PlatformSessionEntity MapToEntity(PlatformSession s) => new()
    {
        Id = s.Id.Value,
        UserId = s.UserId.Value,
        RefreshTokenHash = s.RefreshTokenHash,
        CreatedAt = s.CreatedAt,
        ExpiresAt = s.ExpiresAt,
        RevokedAt = s.RevokedAt,
        CreatedFromIp = s.CreatedFromIp,
    };
}
