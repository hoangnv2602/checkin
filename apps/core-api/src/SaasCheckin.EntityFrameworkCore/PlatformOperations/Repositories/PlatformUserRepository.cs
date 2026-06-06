using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.PlatformOperations.Aggregates;
using SaasCheckin.Domain.PlatformOperations.Repositories;
using SaasCheckin.Domain.PlatformOperations.ValueObjects;

namespace SaasCheckin.EntityFrameworkCore.PlatformOperations.Repositories;

public sealed class PlatformUserRepository : IPlatformUserRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly DbSet<PlatformUserEntityConfiguration.PlatformUserEntity> _table;

    public PlatformUserRepository(SaasCheckinDbContext db)
    {
        _db = db;
        _table = db.Set<PlatformUserEntityConfiguration.PlatformUserEntity>();
    }

    public async Task<PlatformUser?> FindByIdAsync(PlatformUserId id, CancellationToken ct = default)
    {
        var e = await _table.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id.Value, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<PlatformUser?> FindByEmailAsync(string email, CancellationToken ct = default)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        var e = await _table.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email == normalized, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task AddAsync(PlatformUser user, CancellationToken ct = default)
    {
        await _table.AddAsync(MapToEntity(user), ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(PlatformUser user, CancellationToken ct = default)
    {
        var entity = await _table.FirstOrDefaultAsync(x => x.Id == user.Id.Value, ct);
        if (entity is null)
        {
            await AddAsync(user, ct);
            return;
        }
        entity.Email = user.Email.Value;
        entity.FullName = user.FullName;
        entity.PasswordHash = user.PasswordHash;
        entity.Role = (int)user.Role;
        entity.MfaEnabled = user.MfaEnabled;
        entity.MfaSecretBase32 = user.MfaSecret?.Base32;
        entity.LastLoginAt = user.LastLoginAt;
        entity.LockedUntil = user.LockedUntil;
        entity.FailedLoginCount = user.FailedLoginCount;
        entity.UpdatedAt = user.UpdatedAt;
        await _db.SaveChangesAsync(ct);
    }

    private static PlatformUser MapToDomain(PlatformUserEntityConfiguration.PlatformUserEntity e)
    {
        // Domain re-constitute — dùng reflection cho private ctor
        // Lọc đúng ctor có 6 tham số: (PlatformUserId, Email, string fullName, passwordHash, PlatformRole, IClock).
        // Tránh pick nhầm parameterless ctor `private PlatformUser() : base(default!)`.
        var ctor = typeof(PlatformUser).GetConstructors(
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            .First(c => c.GetParameters().Length == 6);
#pragma warning disable CS8601 // Possible null reference assignment.
        var user = (PlatformUser)ctor.Invoke(new object[]
        {
            PlatformUserId.From(e.Id),
            Email.Create(e.Email),
            e.FullName,
            e.PasswordHash,
            (PlatformRole)e.Role,
            new Shared.Domain.Core.SystemClock(),
        });
#pragma warning restore CS8601

        // Set remaining private-setter properties via reflection.
        var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;
        if (e.MfaEnabled || !string.IsNullOrEmpty(e.MfaSecretBase32))
        {
            typeof(PlatformUser).GetProperty(nameof(PlatformUser.MfaEnabled), flags)!.SetValue(user, e.MfaEnabled);
            if (!string.IsNullOrEmpty(e.MfaSecretBase32))
            {
                typeof(PlatformUser).GetProperty(nameof(PlatformUser.MfaSecret), flags)!.SetValue(
                    user, MfaSecret.Parse(e.MfaSecretBase32));
            }
        }
        typeof(PlatformUser).GetProperty(nameof(PlatformUser.LastLoginAt), flags)!.SetValue(user, e.LastLoginAt);
        typeof(PlatformUser).GetProperty(nameof(PlatformUser.LockedUntil), flags)!.SetValue(user, e.LockedUntil);
        typeof(PlatformUser).GetProperty(nameof(PlatformUser.FailedLoginCount), flags)!.SetValue(user, e.FailedLoginCount);
        typeof(PlatformUser).GetProperty(nameof(PlatformUser.CreatedAt), flags)!.SetValue(user, e.CreatedAt);
        typeof(PlatformUser).GetProperty(nameof(PlatformUser.UpdatedAt), flags)!.SetValue(user, e.UpdatedAt);
        return user;
    }

    private static PlatformUserEntityConfiguration.PlatformUserEntity MapToEntity(PlatformUser u) => new()
    {
        Id = u.Id.Value,
        Email = u.Email.Value,
        FullName = u.FullName,
        PasswordHash = u.PasswordHash,
        Role = (int)u.Role,
        MfaEnabled = u.MfaEnabled,
        MfaSecretBase32 = u.MfaSecret?.Base32,
        LastLoginAt = u.LastLoginAt,
        LockedUntil = u.LockedUntil,
        FailedLoginCount = u.FailedLoginCount,
        CreatedAt = u.CreatedAt,
        UpdatedAt = u.UpdatedAt,
    };
}
