// apps/core-api/src/SaasCheckin.EntityFrameworkCore/Audit/HashChainComputer.cs
//
// I-908 — Hash chain computer for audit_log immutability.
//
// Each row's hash = SHA-256(prevHash || id || tenantId || action || actorUserId || occurredAt).
// prevHash of first row in a tenant chain is the genesis hash (64 zeros).
//
// Why this format:
//   - Includes immutable fields only (id, tenant, action, actor, time)
//   - prevHash chaining detects any insert/delete in middle
//   - metadata + ip + ua are NOT in hash (mutable / nullable) — chain
//     integrity matters more than metadata fidelity
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace SaasCheckin.EntityFrameworkCore.Audit;

public static class HashChainComputer
{
    public const string GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";

    public static string ComputeHash(
        string prevHash,
        Guid id,
        Guid tenantId,
        string action,
        Guid actorUserId,
        DateTimeOffset occurredAt)
    {
        var sb = new StringBuilder(256);
        sb.Append(prevHash);
        sb.Append('|');
        sb.Append(id.ToString("N"));
        sb.Append('|');
        sb.Append(tenantId.ToString("N"));
        sb.Append('|');
        sb.Append(action);
        sb.Append('|');
        sb.Append(actorUserId.ToString("N"));
        sb.Append('|');
        sb.Append(occurredAt.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture));

        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    /// <summary>
    /// Verify chain for a tenant. Caller passes rows ordered by occurredAt ASC.
    /// Returns list of (index, expectedHash, actualHash) for any mismatch.
    /// </summary>
    public static IReadOnlyList<HashChainBreak> Verify(
        IEnumerable<AuditChainRow> rowsInOrder)
    {
        var breaks = new List<HashChainBreak>();
        string prev = GenesisHash;
        int index = 0;
        foreach (var row in rowsInOrder)
        {
            var expected = ComputeHash(prev, row.Id, row.TenantId, row.Action, row.ActorUserId, row.OccurredAt);
            if (!string.Equals(expected, row.Hash, StringComparison.Ordinal))
            {
                breaks.Add(new HashChainBreak(index, row.Id, expected, row.Hash));
            }
            if (!string.Equals(row.PrevHash, prev, StringComparison.Ordinal))
            {
                breaks.Add(new HashChainBreak(index, row.Id, prev, row.PrevHash));
            }
            prev = row.Hash;
            index++;
        }
        return breaks;
    }
}

public sealed record AuditChainRow(
    Guid Id,
    Guid TenantId,
    string Action,
    Guid ActorUserId,
    DateTimeOffset OccurredAt,
    string PrevHash,
    string Hash);

public sealed record HashChainBreak(int Index, Guid RowId, string Expected, string Actual);
