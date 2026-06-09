using Microsoft.Extensions.Configuration;
using StackExchange.Redis;
using System.Text.Json;

namespace OrionAirline.Persistence;

public class RedisCacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly int _flightSearchTtl;
    private readonly int _bookingCacheTtl;

    public RedisCacheService(IConnectionMultiplexer redis, IConfiguration configuration)
    {
        _redis = redis;
        _flightSearchTtl = configuration.GetValue<int>("Redis:FlightSearchCacheTtlMinutes", 5);
        _bookingCacheTtl = configuration.GetValue<int>("Redis:BookingCacheTtlMinutes", 10);
    }

    public async Task<T?> GetAsync<T>(string key) where T : class
    {
        var db = _redis.GetDatabase();
        var value = await db.StringGetAsync(key);
        return value.HasValue ? JsonSerializer.Deserialize<T>(value!) : null;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? ttl = null) where T : class
    {
        var db = _redis.GetDatabase();
        var serialized = JsonSerializer.Serialize(value);
        await db.StringSetAsync(key, serialized, ttl);
    }

    public async Task RemoveAsync(string key)
    {
        var db = _redis.GetDatabase();
        await db.KeyDeleteAsync(key);
    }

    public static string BuildFlightSearchKey(string origin, string destination, string date)
    {
        return $"flight-search:{origin}:{destination}:{date}";
    }

    public static string BuildFlightKey(string flightId)
    {
        return $"flight:{flightId}";
    }

    public static string BuildBookingKey(string bookingId)
    {
        return $"booking:{bookingId}";
    }

    public static string BuildSeatLockKey(string flightId, string seatNumber)
    {
        return $"seat-lock:{flightId}:{seatNumber}";
    }

    public async Task<bool> AcquireDistributedLockAsync(string key, string owner, TimeSpan expiry)
    {
        var db = _redis.GetDatabase();
        return await db.LockTakeAsync(key, owner, expiry);
    }

    public async Task ReleaseDistributedLockAsync(string key, string owner)
    {
        var db = _redis.GetDatabase();
        await db.LockReleaseAsync(key, owner);
    }

    public async Task<bool> CheckRateLimitAsync(string clientId, int maxRequests, TimeSpan window)
    {
        var db = _redis.GetDatabase();
        var key = $"ratelimit:{clientId}";
        var count = await db.StringIncrementAsync(key);
        if (count == 1)
        {
            await db.KeyExpireAsync(key, window);
        }
        return count <= maxRequests;
    }
}
