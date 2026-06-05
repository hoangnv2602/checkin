using Microsoft.EntityFrameworkCore;
using SaasCheckin.Domain.Identity.Aggregates;
using SaasCheckin.Domain.Identity.Repositories;
using SaasCheckin.Domain.Identity.ValueObjects;

namespace SaasCheckin.EntityFrameworkCore.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly DbSet<Identity.UserEntityConfiguration.UserEntity> _table;

    public UserRepository(SaasCheckinDbContext db)
    {
        _db = db;
        _table = db.Set<Identity.UserEntityConfiguration.UserEntity>();
    }

    public async Task<User?> FindByIdAsync(UserId id, CancellationToken ct = default)
    {
        var entity = await _table.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id.Value, ct);
        return entity is null ? null : MapToDomain(entity);
    }

    public async Task<User?> FindByEmailAsync(Email email, CancellationToken ct = default)
    {
        var entity = await _table.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email == email.Value, ct);
        return entity is null ? null : MapToDomain(entity);
    }

    public async Task<bool> ExistsByEmailAsync(Email email, CancellationToken ct = default)
    {
        return await _table.AsNoTracking().AnyAsync(x => x.Email == email.Value, ct);
    }

    public async Task AddAsync(User aggregate, CancellationToken ct = default)
    {
        var entity = MapToEntity(aggregate);
        await _table.AddAsync(entity, ct);
    }

    public async Task UpdateAsync(User aggregate, CancellationToken ct = default)
    {
        var entity = await _table.FirstOrDefaultAsync(x => x.Id == aggregate.Id.Value, ct);
        if (entity is null)
        {
            await AddAsync(aggregate, ct);
            return;
        }
        entity.EmailVerifiedAt = aggregate.EmailVerifiedAt;
        entity.LastLoginAt = aggregate.LastLoginAt;
        entity.LockedUntil = aggregate.LockedUntil;
        entity.FailedLoginCount = aggregate.FailedLoginCount;
        entity.AvatarUrl = aggregate.AvatarUrl;
        entity.Locale = aggregate.Locale;
        entity.FullName = aggregate.FullName.Value;
        entity.Email = aggregate.Email.Value;
        entity.PasswordHash = aggregate.PasswordHash;
        entity.UpdatedAt = aggregate.UpdatedAt;
    }

    public void Remove(User aggregate)
    {
        _table.Remove(new Identity.UserEntityConfiguration.UserEntity { Id = aggregate.Id.Value });
    }

    private static User MapToDomain(Identity.UserEntityConfiguration.UserEntity e)
    {
        // Domain re-constitute — dùng reflection cho private ctor
        var ctor = typeof(User).GetConstructors(
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            .First();
#pragma warning disable CS8601 // Possible null reference assignment.
        var user = (User)ctor.Invoke(new object[]
        {
            UserId.From(e.Id),
            Email.Create(e.Email),
            FullName.Create(e.FullName),
            e.PasswordHash,
            new Shared.Domain.Core.SystemClock(),
        });
#pragma warning restore CS8601
        // Set private fields via reflection
        typeof(User).GetProperty(nameof(User.EmailVerifiedAt))!.SetValue(user, e.EmailVerifiedAt);
        typeof(User).GetProperty(nameof(User.LastLoginAt))!.SetValue(user, e.LastLoginAt);
        typeof(User).GetProperty(nameof(User.LockedUntil))!.SetValue(user, e.LockedUntil);
        typeof(User).GetProperty(nameof(User.FailedLoginCount))!.SetValue(user, e.FailedLoginCount);
        typeof(User).GetProperty(nameof(User.AvatarUrl))!.SetValue(user, e.AvatarUrl);
        typeof(User).GetProperty(nameof(User.Locale))!.SetValue(user, e.Locale);
        typeof(User).GetProperty(nameof(User.CreatedAt))!.SetValue(user, e.CreatedAt);
        typeof(User).GetProperty(nameof(User.UpdatedAt))!.SetValue(user, e.UpdatedAt);
        return user;
    }

    private static Identity.UserEntityConfiguration.UserEntity MapToEntity(User u) => new()
    {
        Id = u.Id.Value,
        Email = u.Email.Value,
        FullName = u.FullName.Value,
        PasswordHash = u.PasswordHash,
        AvatarUrl = u.AvatarUrl,
        Locale = u.Locale,
        EmailVerifiedAt = u.EmailVerifiedAt,
        LastLoginAt = u.LastLoginAt,
        LockedUntil = u.LockedUntil,
        FailedLoginCount = u.FailedLoginCount,
        CreatedAt = u.CreatedAt,
        UpdatedAt = u.UpdatedAt,
    };
}

public sealed class OrganizationRepository : IOrganizationRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly DbSet<Identity.OrganizationEntityConfiguration.OrganizationEntity> _table;

    public OrganizationRepository(SaasCheckinDbContext db)
    {
        _db = db;
        _table = db.Set<Identity.OrganizationEntityConfiguration.OrganizationEntity>();
    }

    public async Task<Organization?> FindByIdAsync(OrganizationId id, CancellationToken ct = default)
    {
        var e = await _table.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id.Value, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<Organization?> FindBySlugAsync(OrgSlug slug, CancellationToken ct = default)
    {
        var e = await _table.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug.Value, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<bool> ExistsBySlugAsync(OrgSlug slug, CancellationToken ct = default)
    {
        return await _table.AsNoTracking().AnyAsync(x => x.Slug == slug.Value, ct);
    }

    public async Task AddAsync(Organization aggregate, CancellationToken ct = default)
    {
        await _table.AddAsync(MapToEntity(aggregate), ct);
    }

    public async Task UpdateAsync(Organization aggregate, CancellationToken ct = default)
    {
        var entity = await _table.FirstOrDefaultAsync(x => x.Id == aggregate.Id.Value, ct);
        if (entity is null) { await AddAsync(aggregate, ct); return; }
        entity.Name = aggregate.Name;
        entity.DefaultLocale = aggregate.DefaultLocale;
        entity.DefaultCurrency = aggregate.DefaultCurrency;
        entity.Timezone = aggregate.Timezone;
        entity.UpdatedAt = aggregate.UpdatedAt;
    }

    public void Remove(Organization aggregate)
    {
        _table.Remove(new Identity.OrganizationEntityConfiguration.OrganizationEntity { Id = aggregate.Id.Value });
    }

    private static Organization MapToDomain(Identity.OrganizationEntityConfiguration.OrganizationEntity e)
    {
        var ctor = typeof(Organization).GetConstructors(
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            .First();
        var org = (Organization)ctor.Invoke(new object?[]
        {
            OrganizationId.From(e.Id),
            e.Name,
            OrgSlug.Create(e.Slug),
            e.DefaultLocale,
            e.DefaultCurrency,
            e.Timezone,
            new Shared.Domain.Core.SystemClock(),
        });
        typeof(Organization).GetProperty(nameof(Organization.CreatedAt))!.SetValue(org, e.CreatedAt);
        typeof(Organization).GetProperty(nameof(Organization.UpdatedAt))!.SetValue(org, e.UpdatedAt);
        return org;
    }

    private static Identity.OrganizationEntityConfiguration.OrganizationEntity MapToEntity(Organization o) => new()
    {
        Id = o.Id.Value,
        Name = o.Name,
        Slug = o.Slug.Value,
        DefaultLocale = o.DefaultLocale,
        DefaultCurrency = o.DefaultCurrency,
        Timezone = o.Timezone,
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt,
    };
}

public sealed class MembershipRepository : IMembershipRepository
{
    private readonly SaasCheckinDbContext _db;
    private readonly DbSet<Identity.MembershipEntityConfiguration.MembershipEntity> _table;

    public MembershipRepository(SaasCheckinDbContext db)
    {
        _db = db;
        _table = db.Set<Identity.MembershipEntityConfiguration.MembershipEntity>();
    }

    public async Task<Membership?> FindByIdAsync(MembershipId id, CancellationToken ct = default)
    {
        var e = await _table.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id.Value, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<IReadOnlyList<Membership>> ListActiveByUserAsync(UserId userId, CancellationToken ct = default)
    {
        var list = await _table.AsNoTracking()
            .Where(x => x.UserId == userId.Value && x.Status == 1)  // 1 = Active
            .ToListAsync(ct);
        return list.Select(MapToDomain).ToList();
    }

    public async Task<Membership?> FindActiveAsync(UserId userId, OrganizationId organizationId, CancellationToken ct = default)
    {
        var e = await _table.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId.Value && x.TenantId == organizationId.Value && x.Status == 1, ct);
        return e is null ? null : MapToDomain(e);
    }

    public async Task<bool> ExistsAsync(UserId userId, OrganizationId organizationId, CancellationToken ct = default)
    {
        return await _table.AsNoTracking()
            .AnyAsync(x => x.UserId == userId.Value && x.TenantId == organizationId.Value, ct);
    }

    public async Task AddAsync(Membership aggregate, CancellationToken ct = default)
    {
        await _table.AddAsync(MapToEntity(aggregate), ct);
    }

    public async Task UpdateAsync(Membership aggregate, CancellationToken ct = default)
    {
        var entity = await _table.FirstOrDefaultAsync(x => x.Id == aggregate.Id.Value, ct);
        if (entity is null) { await AddAsync(aggregate, ct); return; }
        entity.Role = aggregate.Role.Value;
        entity.Status = (int)aggregate.Status;
        entity.JoinedAt = aggregate.JoinedAt;
        entity.RevokedAt = aggregate.RevokedAt;
    }

    public void Remove(Membership aggregate)
    {
        _table.Remove(new Identity.MembershipEntityConfiguration.MembershipEntity { Id = aggregate.Id.Value });
    }

    private static Membership MapToDomain(Identity.MembershipEntityConfiguration.MembershipEntity e)
    {
        var ctor = typeof(Membership).GetConstructors(
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            .First();
        var m = (Membership)ctor.Invoke(new object?[]
        {
            MembershipId.From(e.Id),
            UserId.From(e.UserId),
            OrganizationId.From(e.TenantId),
            Role.Create(e.Role),
            e.InvitedAt,
        });
        typeof(Membership).GetProperty(nameof(Membership.JoinedAt))!.SetValue(m, e.JoinedAt);
        typeof(Membership).GetProperty(nameof(Membership.RevokedAt))!.SetValue(m, e.RevokedAt);
        typeof(Membership).GetProperty(nameof(Membership.Status))!.SetValue(m, (MembershipStatus)e.Status);
        return m;
    }

    private static Identity.MembershipEntityConfiguration.MembershipEntity MapToEntity(Membership m) => new()
    {
        Id = m.Id.Value,
        UserId = m.UserId.Value,
        TenantId = m.OrganizationId.Value,
        Role = m.Role.Value,
        Status = (int)m.Status,
        InvitedAt = m.InvitedAt,
        JoinedAt = m.JoinedAt,
        RevokedAt = m.RevokedAt,
    };
}
