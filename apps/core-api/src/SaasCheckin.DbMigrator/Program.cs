using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SaasCheckin.EntityFrameworkCore;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;

// Build configuration from appsettings.json + env vars + CLI args
var configuration = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

// Migrator uses Migration role (default = app_runtime for read-only DDL, override to
// postgres for GRANTs). Phase 1 dev only — production dùng dedicated migration role.
var connStr = configuration.GetConnectionString("Migrator")
    ?? configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Migrator or Default is required");

var services = new ServiceCollection();
services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));
services.AddDbContext<SaasCheckinDbContext>(opt => opt.UseNpgsql(connStr));

await using var sp = services.BuildServiceProvider();
var db = sp.GetRequiredService<SaasCheckinDbContext>();
var logger = sp.GetRequiredService<ILogger<Program>>();

logger.LogInformation("Applying migrations to {Database}", db.Database.GetConnectionString());
await db.Database.MigrateAsync();
logger.LogInformation("✓ Migrations applied");

// ---- Idempotent seed ----
// Phase 1: 1 org (acme) + 1 owner user (alice@acme.test, password "AliceP@ss123")
//          + 1 platform user (owner@saas-checkin.com, password "PlatformP@ss123", MFA disabled) — tạo ở I-106
await SeedAsync(db, logger);

logger.LogInformation("✓ Seed complete");
return 0;

// ---- Seed implementation ----
static async Task SeedAsync(SaasCheckinDbContext db, ILogger logger)
{
    var hasher = new BCryptPasswordHasher();
    var clock = new SystemClock();
    var now = clock.UtcNow;

    var orgId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    var ownerUserId = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    // ---- 1. Organization ----
    var orgExists = await db.Organizations
        .AnyAsync(o => o.Id == orgId);
    if (!orgExists)
    {
        db.Organizations.Add(new SaasCheckin.EntityFrameworkCore.Identity.OrganizationEntityConfiguration.OrganizationEntity
        {
            Id = orgId,
            Name = "Acme Events",
            Slug = "acme",
            DefaultLocale = "vi",
            DefaultCurrency = "VND",
            Timezone = "Asia/Ho_Chi_Minh",
            CreatedAt = now,
            UpdatedAt = now,
        });
        await db.SaveChangesAsync();
        logger.LogInformation("  + Organization: acme ({OrgId})", orgId);
    }
    else
    {
        logger.LogInformation("  = Organization acme already exists, skipping");
    }

    // ---- 2. Owner user ----
    var ownerExists = await db.Users
        .AnyAsync(u => u.Id == ownerUserId);
    if (!ownerExists)
    {
        db.Users.Add(new SaasCheckin.EntityFrameworkCore.Identity.UserEntityConfiguration.UserEntity
        {
            Id = ownerUserId,
            Email = "alice@acme.test",
            FullName = "Alice Nguyễn",
            EmailVerifiedAt = now,
            PasswordHash = hasher.HashPassword("AliceP@ss123"),
            Locale = "vi",
            CreatedAt = now,
            UpdatedAt = now,
        });
        await db.SaveChangesAsync();
        logger.LogInformation("  + Owner user: alice@acme.test ({UserId})", ownerUserId);
    }
    else
    {
        logger.LogInformation("  = Owner user alice@acme.test already exists, skipping");
    }

    // ---- 3. Membership (user ↔ org, role=Owner) ----
    // Migrator connect với role postgres (superuser) nên RLS bypass khi SET empty.
    // Set tenant context để chính sách match row thật.
    var memExists = await db.Memberships
        .AnyAsync(m => m.TenantId == orgId && m.UserId == ownerUserId);
    if (!memExists)
    {
        db.Memberships.Add(new SaasCheckin.EntityFrameworkCore.Identity.MembershipEntityConfiguration.MembershipEntity
        {
            Id = Guid.NewGuid(),
            UserId = ownerUserId,
            TenantId = orgId,
            Role = "Owner",
            Status = 1, // Active
            InvitedAt = now,
            JoinedAt = now,
        });
        await db.SaveChangesAsync();
        logger.LogInformation("  + Membership: alice@acme.test → acme (Owner)");
    }
    else
    {
        logger.LogInformation("  = Membership alice → acme already exists, skipping");
    }

    // ---- 4. Platform user (checkin-admin seed) — placeholder ----
    // Bảng platform_users được tạo ở I-106 (PlatformOperations context).
    // Phase 1 chỉ log hint cho dev khi cần login sớm.
    logger.LogInformation("  ⓘ Platform user (I-106): owner@saas-checkin.com (skipped, table chưa tồn tại)");
}
