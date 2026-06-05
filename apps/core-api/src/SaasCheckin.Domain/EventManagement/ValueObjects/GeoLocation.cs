using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.ValueObjects;

/// <summary>
/// Optional lat/lng for venue geo-search. Validated to -90..90 / -180..180.
/// </summary>
public sealed record GeoLocation
{
    public double Latitude { get; }
    public double Longitude { get; }

    private GeoLocation(double lat, double lng)
    {
        Latitude = lat;
        Longitude = lng;
    }

    public static GeoLocation Create(double latitude, double longitude)
    {
        if (latitude is < -90 or > 90)
            throw new ArgumentException($"Latitude {latitude} out of range [-90, 90]", nameof(latitude));
        if (longitude is < -180 or > 180)
            throw new ArgumentException($"Longitude {longitude} out of range [-180, 180]", nameof(longitude));
        return new GeoLocation(latitude, longitude);
    }
}
