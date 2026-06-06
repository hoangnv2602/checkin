using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.EventManagement.ValueObjects;

/// <summary>
/// Postal address cho Venue. Không bắt buộc mọi field (một số venue online chỉ có country).
/// </summary>
public sealed record VenueAddress
{
    public string? StreetLine1 { get; }
    public string? StreetLine2 { get; }
    public string? City { get; }
    public string? Region { get; }       // state / province
    public string? PostalCode { get; }
    public string Country { get; }       // ISO 3166-1 alpha-2 (required)

    private VenueAddress(
        string? streetLine1,
        string? streetLine2,
        string? city,
        string? region,
        string? postalCode,
        string country)
    {
        StreetLine1 = streetLine1?.Trim();
        StreetLine2 = streetLine2?.Trim();
        City = city?.Trim();
        Region = region?.Trim();
        PostalCode = postalCode?.Trim();
        Country = country.Trim().ToUpperInvariant();
    }

    public static VenueAddress Create(
        string country,
        string? streetLine1 = null,
        string? streetLine2 = null,
        string? city = null,
        string? region = null,
        string? postalCode = null)
    {
        Guard.NotNullOrWhiteSpace(country, nameof(country));
        if (country.Trim().Length != 2)
            throw new ArgumentException("Country phải là ISO 3166-1 alpha-2 (2 ký tự)", nameof(country));
        return new VenueAddress(streetLine1, streetLine2, city, region, postalCode, country);
    }
}
