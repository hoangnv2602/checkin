# Audit log immutability (I-908)

> **Phase 9 — Platform Maturity.** R-21 guardrail: detect tampering của audit log
> bằng hash chain. Mỗi row chứa `prev_hash` + `hash` = SHA-256 của row trước
> + immutable fields.

## Schema

```sql
ALTER TABLE audit_log ADD COLUMN prev_hash CHAR(64) NOT NULL DEFAULT '000…000';
ALTER TABLE audit_log ADD COLUMN hash CHAR(64) NOT NULL DEFAULT '000…000';
```

`prev_hash` của row đầu tiên trong tenant chain = genesis (`"0" * 64`).

## Hash format

```
hash = SHA-256(prev_hash || id || tenant_id || action || actor_user_id || occurred_at_unix_ms)
```

Chỉ include **immutable** fields (id, tenant, action, actor, occurredAt). Metadata
+ IP + UA deliberately excluded — chúng có thể thay đổi (UA string update,
IP forward proxy thay đổi) nhưng chain integrity mới là forensic concern.

## INSERT flow

```csharp
// apps/core-api/src/SaasCheckin.EntityFrameworkCore/Audit/AuditLogWriter.cs (Phase 10)
var lastHash = await db.AuditLog
    .Where(a => a.TenantId == entry.TenantId)
    .OrderByDescending(a => a.OccurredAt)
    .Select(a => a.Hash)
    .FirstOrDefaultAsync() ?? HashChainComputer.GenesisHash;

entry.PrevHash = lastHash;
entry.Hash = HashChainComputer.ComputeHash(
    lastHash, entry.Id, entry.TenantId, entry.Action,
    entry.ActorUserId, entry.OccurredAt);
await db.AuditLog.AddAsync(entry);
await db.SaveChangesAsync();
```

## Verify job (cron 6h)

```csharp
// apps/core-api/src/SaasCheckin.Infrastructure/Jobs/AuditHashChainVerifyJob.cs
var breaks = new List<HashChainBreak>();
foreach (var tenantId in tenantIds)
{
    var rows = await db.AuditLog
        .Where(a => a.TenantId == tenantId)
        .OrderBy(a => a.OccurredAt)
        .Select(a => new AuditChainRow(...))
        .ToListAsync();
    breaks.AddRange(HashChainComputer.Verify(rows));
}
if (breaks.Count > 0)
{
    await alertService.SendAsync(Severity.Critical,
        $"audit hash chain breaks detected: {breaks.Count}",
        breaks.Take(20).Select(b => $"row {b.RowId} expected {b.Expected[..8]} got {b.Actual[..8]}"));
}
```

Alert routing: Sentry (Phase 6) + Slack ops channel (I-802) + PagerDuty (Phase 10+).

## Failure modes

- **Single row DELETE/UPDATE**: chain breaks at next row (prev_hash mismatch)
- **Bulk DELETE**: many consecutive breaks — alert immediately
- **Migration adds new column**: hash format unchanged, no re-chain needed
- **Initial backfill**: ALTER TABLE backfill hash cho existing rows. Run in batch
  theo `occurred_at` ASC, prev_hash chain off previous batch's last row.

## Out of scope (Phase 10+)

- DB trigger enforce immutable (BEFORE UPDATE/DELETE → RAISE EXCEPTION)
- WORM storage (S3 Object Lock) cho cold archive
- Merkle root snapshot daily (cheaper verification)
- Per-row signature với HSM key
