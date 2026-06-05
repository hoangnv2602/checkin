using SaasCheckin.Shared.Domain.Core;

namespace SaasCheckin.Domain.Identity.ValueObjects;

/// <summary>
/// Role value object — 1 trong 5 role hợp lệ (mirror RolePermissionMap).
/// Phase 2+ cho phép custom role per-tenant; schema DB là VARCHAR(40) + CHECK
/// constraint (xem ADR-0015 §3).
/// </summary>
public sealed record Role
{
    public const string Owner = "owner";
    public const string Admin = "admin";
    public const string Organizer = "organizer";
    public const string Staff = "staff";
    public const string Viewer = "viewer";

    private static readonly HashSet<string> ValidRoles = new(StringComparer.Ordinal)
    {
        Owner, Admin, Organizer, Staff, Viewer,
    };

    public string Value { get; }

    private Role(string value) => Value = value;

    public static Role Create(string value)
    {
        Guard.NotNullOrWhiteSpace(value);

        var normalized = value.Trim().ToLowerInvariant();
        if (!ValidRoles.Contains(normalized))
            throw new ArgumentException(
                $"Role không hợp lệ: '{value}'. Hợp lệ: {string.Join(", ", ValidRoles)}.",
                nameof(value));

        return new Role(normalized);
    }

    public static Role FromStringUnsafe(string value) => Create(value);

    public override string ToString() => Value;

    public static IReadOnlyCollection<string> AllValidRoles => ValidRoles;
}
