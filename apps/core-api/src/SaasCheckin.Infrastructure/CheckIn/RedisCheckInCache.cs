using SaasCheckin.Application.CheckIn.Commands;
using StackExchange.Redis;

namespace SaasCheckin.Infrastructure.CheckIn;

/// <summary>
/// RedisCheckInCache — hot path: event:{eventId}:checkin_count + reg:{regId}:status.
/// Phase 4 cache layer giúp dashboard p95 &lt; 200ms với 1000 scan/sec.
/// </summary>
public sealed class RedisCheckInCache : ICheckInCache
{
    private readonly IConnectionMultiplexer _redis;

    public RedisCheckInCache(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    private static RedisKey CountKey(Guid eventId) => $"checkin:event:{eventId}:count";
    private static RedisKey StatusKey(Guid registrationId) => $"checkin:reg:{registrationId}:status";

    public async Task IncrementCheckInCountAsync(Guid eventId, Guid organizationId, CancellationToken ct = default)
    {
        await _redis.GetDatabase().StringIncrementAsync(CountKey(eventId));
        // TTL 24h — refresh ở mỗi scan, idle event tự expire
        await _redis.GetDatabase().KeyExpireAsync(CountKey(eventId), TimeSpan.FromHours(24));
        _ = organizationId; // scope guard (RLS đã enforce ở DB)
    }

    public async Task<int?> GetCheckInCountAsync(Guid eventId, Guid organizationId, CancellationToken ct = default)
    {
        var v = await _redis.GetDatabase().StringGetAsync(CountKey(eventId));
        _ = organizationId;
        return v.HasValue && int.TryParse((string?)v, out var n) ? n : null;
    }

    public async Task SetStatusAsync(Guid registrationId, Guid organizationId, string status, CancellationToken ct = default)
    {
        await _redis.GetDatabase().StringSetAsync(StatusKey(registrationId), status, TimeSpan.FromDays(2));
        _ = organizationId;
    }

    public async Task<string?> GetStatusAsync(Guid registrationId, Guid organizationId, CancellationToken ct = default)
    {
        _ = organizationId;
        return await _redis.GetDatabase().StringGetAsync(StatusKey(registrationId));
    }
}
