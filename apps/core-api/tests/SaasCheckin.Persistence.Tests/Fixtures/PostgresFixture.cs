// Tests/SaasCheckin.Persistence.Tests/Fixtures/PostgresFixture.cs
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Respawn;
using SaasCheckin.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace SaasCheckin.Persistence.Tests.Fixtures;

/// <summary>
/// Shared Testcontainers Postgres fixture cho integration tests.
/// Spin up 1 container, run migrations, expose DbContextOptions + Respawn checkpoint.
/// Mỗi test class reset DB qua <see cref="ResetAsync"/>.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlBuilder _builder = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("saas_checkin_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .WithCleanUp(true);

    private PostgreSqlContainer? _container;
    private Respawner? _respawner;

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        _container = _builder.Build();
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();

        // Apply migrations via raw SQL — the InitialIdentity migration file is
        // embedded in the EF assembly. Use EF design-time services to apply.
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();

        // Ensure app_runtime role + RLS setup. We use the postgres superuser for
        // admin (BYPASSRLS implicit) and the app_runtime role for tenant-scoped
        // tests.
        await EnsureRolesAsync(conn);

        // Apply EF Core migrations
        var options = new DbContextOptionsBuilder<SaasCheckinDbContext>()
            .UseNpgsql(ConnectionString, npg => npg.MigrationsAssembly("SaasCheckin.EntityFrameworkCore"))
            .Options;
        await using var ctx = new SaasCheckinDbContext(options, Array.Empty<Microsoft.EntityFrameworkCore.Diagnostics.IInterceptor>());
        await ctx.Database.MigrateAsync();

        // Build Respawn checkpoint (skip tables we don't want to nuke)
        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = ["__EFMigrationsHistory"],
        });
    }

    public async Task ResetAsync()
    {
        if (_respawner is null) return;
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    public DbContextOptions<SaasCheckinDbContext> NewDbContextOptions()
    {
        return new DbContextOptionsBuilder<SaasCheckinDbContext>()
            .UseNpgsql(ConnectionString, npg => npg.MigrationsAssembly("SaasCheckin.EntityFrameworkCore"))
            .Options;
    }

    public NpgsqlConnection NewConnection()
    {
        var conn = new NpgsqlConnection(ConnectionString);
        conn.Open();
        return conn;
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
            await _container.DisposeAsync();
    }

    private static async Task EnsureRolesAsync(NpgsqlConnection conn)
    {
        // Create the app_runtime role with row-level security enforcement,
        // plus the app_platform_owner role required by I-106 migrations.
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
                    CREATE ROLE app_runtime LOGIN PASSWORD 'app_runtime_dev';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform_owner') THEN
                    CREATE ROLE app_platform_owner LOGIN PASSWORD 'app_platform_owner_dev' BYPASSRLS;
                END IF;
            END $$;
            GRANT CONNECT ON DATABASE saas_checkin_test TO app_runtime;
            GRANT CONNECT ON DATABASE saas_checkin_test TO app_platform_owner;
            GRANT USAGE ON SCHEMA public TO app_runtime;
            GRANT USAGE ON SCHEMA public TO app_platform_owner;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_platform_owner;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_platform_owner;
        ";
        await cmd.ExecuteNonQueryAsync();
    }
}
