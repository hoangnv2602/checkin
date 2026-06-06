// apps/core-api/src/SaasCheckin.EntityFrameworkCore/ReadReplicaDbContextProvider.cs
// I-805 — Provider chọn DbContext + monitor replica health.
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace SaasCheckin.EntityFrameworkCore;

public sealed class ReadReplicaDbContextProvider : IDbContextProvider
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<ReadReplicaDbContextProvider> _logger;
    private readonly string _replicaConnectionString;
    private readonly TimeSpan _probeInterval = TimeSpan.FromSeconds(10);
    private DateTime _lastProbe = DateTime.MinValue;
    private bool _replicaAvailable;
    private TimeSpan? _replicaLag;

    public ReadReplicaDbContextProvider(
        IServiceProvider sp,
        ILogger<ReadReplicaDbContextProvider> logger)
    {
        _sp = sp;
        _logger = logger;
        _replicaConnectionString =
            Environment.GetEnvironmentVariable("DATABASE__READONLY_CONNECTION")
            ?? Environment.GetEnvironmentVariable("DATABASE_READONLY_CONNECTION")
            ?? "";
    }

    public DbContext GetWriteContext()
    {
        var ctx = _sp.GetService(typeof(SaasCheckinDbContext)) as DbContext
            ?? throw new InvalidOperationException("SaasCheckinDbContext not registered");
        return ctx;
    }

    public DbContext GetReadContext()
    {
        // Replica down → fallback write context (log warning, return read context anyway
        // nhưng flag sẽ là unhealthy cho monitoring).
        if (string.IsNullOrEmpty(_replicaConnectionString) || !IsReplicaAvailableAsync().GetAwaiter().GetResult())
        {
            return GetWriteContext();
        }
        var ctx = _sp.GetService(typeof(SaasCheckinReadDbContext)) as DbContext
            ?? throw new InvalidOperationException("SaasCheckinReadDbContext not registered");
        return ctx;
    }

    public async Task<bool> IsReplicaAvailableAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_replicaConnectionString)) return false;
        if (DateTime.UtcNow - _lastProbe < _probeInterval) return _replicaAvailable;

        _lastProbe = DateTime.UtcNow;
        var sw = Stopwatch.StartNew();
        try
        {
            await using var conn = new NpgsqlConnection(_replicaConnectionString);
            await conn.OpenAsync(ct);
            await using var cmd = new NpgsqlCommand("SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int", conn);
            var lagSeconds = (int?)await cmd.ExecuteScalarAsync(ct) ?? 0;
            _replicaLag = TimeSpan.FromSeconds(lagSeconds);
            _replicaAvailable = true;
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "read replica probe failed");
            _replicaAvailable = false;
            _replicaLag = null;
            return false;
        }
        finally
        {
            sw.Stop();
        }
    }

    public TimeSpan? ReplicaLag => _replicaLag;
}
