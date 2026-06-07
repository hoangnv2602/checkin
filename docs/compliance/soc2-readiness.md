# SOC 2 readiness checklist (I-910)

> **Phase 9 — Platform Maturity.** Gap analysis + control mapping cho SOC 2 Type II audit.
> Out of scope cho MVP: full SOC 2 audit (cần auditor + 6 tháng evidence). Doc này
> cover readiness, không phải audit report.

## Trust Service Criteria mapping

### CC1 — Control environment

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Code of conduct published | ✅ | `docs/legal/code-of-conduct.md` (Phase 7 I-705) | none |
| Org chart + roles documented | ✅ | `docs/03-monorepo.md`, ADRs | none |
| Hiring + onboarding checklist | ⚠️ partial | Informal, no formal HR doc | write HR onboarding doc (Phase 10) |
| Background checks | N/A | Out of scope for solo founder | document as exclusion |

### CC2 — Communication & information

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Internal security training | ⚠️ | None yet | Phase 10 — annual training doc |
| Customer-facing security page | ✅ | `docs/security/` (audit-log-immutability, ...) | extend as needed |
| Incident communication plan | ✅ | `docs/operations/incident-response.md` (I-911) | drill quarterly |

### CC3 — Risk assessment

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Risk register maintained | ✅ | `docs/11-risks.md` (23 risks) | quarterly review |
| Vendor risk assessment | ⚠️ | Stripe/Resend/Twilio/Caddy — used, no formal review | Phase 10 DPA + vendor review checklist |
| Penetration test | ⚠️ | Basic pen-test planned Phase 7 I-701; not run yet | run annual external pen-test |

### CC4 — Monitoring

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Audit log immutable | ✅ | I-908 hash chain | verify job (Phase 10) |
| Audit log retention | ⚠️ | 90d (Phase 1); SOC 2 needs 1y+ | extend to 2y retention |
| Continuous monitoring | ✅ | Uptime Kuma (Phase 6) + Sentry (Phase 6) + OTel (Phase 6) | none |
| Alerting on anomalies | ✅ | Sentry + Slack/Discord (I-802) | add PagerDuty rotation |

### CC5 — Control activities

| Control | Status | Implementation | Gap |
|---------|--------|----------------|---------|
| Change management | ✅ | PR + review + CI (Phase 0) | document release process |
| Separation of duties | ⚠️ | Solo dev — no separation | document as risk; mitigate via CODEOWNERS |
| Access reviews | ⚠️ | Ad-hoc | quarterly access review (Phase 10) |

### CC6 — Logical & physical access

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| MFA on privileged accounts | ✅ | TOTP enforced (Phase 1) | none |
| IP allowlist for admin | ✅ | Cloudflare WAF (Phase 1) | none |
| Principle of least privilege | ✅ | Hybrid RBAC D13 + RLS (Phase 1) | audit role assignments quarterly |
| Offboarding | ⚠️ | Manual — no checklist | HR offboarding doc + automate via SCIM (Phase 10) |
| Encryption at rest | ⚠️ | App data: postgres TDE not enabled | enable pgcrypto extension (Phase 10) |
| Encryption in transit | ✅ | TLS everywhere (Phase 0) | HSTS preload (Phase 7 I-701) |

### CC7 — System operations

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Backup + restore | ✅ | pgbackrest daily (Phase 7 I-702) | quarterly drill |
| Disaster recovery | ⚠️ | Single VPS, no DR region | Phase 10: cross-region replica |
| Capacity monitoring | ✅ | Prometheus + Grafana (Phase 6) | none |
| Incident response | ✅ | Runbook I-911 | quarterly drill |

### CC8 — Change management

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Source control | ✅ | Git, branch protection | none |
| Code review | ✅ | 1 approval minimum | enforce 2 for security-sensitive files |
| CI/CD | ✅ | GitHub Actions matrix (Phase 0) | add deployment approval gate |
| Rollback plan | ✅ | Per-PR migration script + revert | document deployment rollback (Phase 10) |

### CC9 — Risk mitigation

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Business continuity plan | ⚠️ | Implicit in runbooks | formal BCP doc (Phase 10) |
| Insurance | N/A | Out of scope | acquire cyber insurance before enterprise customers |

## Privacy (GDPR + equivalents)

| Control | Status | Implementation | Gap |
|---------|--------|----------------|-----|
| Data residency choice | ✅ | I-902 multi-region | EU + SG opt-in |
| Right to access | ⚠️ | Data export API exists, no formal flow | Phase 10 self-serve data export |
| Right to erasure | ⚠️ | Soft delete + RLS, no hard delete | Phase 10 GDPR delete endpoint |
| Data processing agreement | ⚠️ | DPA draft in legal templates | sign with each customer |
| Privacy policy | ✅ | `docs/legal/privacy.md` (Phase 7 I-705) | update annually |

## Penetration test follow-up

Vulns from previous pen-test (Phase 7 I-701, basic):
- [ ] SQL injection probe: clean
- [ ] XSS probe: clean
- [ ] CSRF: tokens issued, validate on state-changing endpoints
- [ ] Auth bypass: RLS defense-in-depth verified
- [ ] Rate limit: per-tenant (I-807) + global
- [ ] Webhook signature: HMAC (I-901)

## Audit timeline (proposed)

| Milestone | Target | Owner |
|-----------|--------|-------|
| Gap closure | Q3 2026 | Tech lead |
| External SOC 2 readiness assessment | Q4 2026 | Auditor (TBD: Drata/Vanta/Secureframe?) |
| 6-month evidence collection | Q1 2027 | All hands |
| Type I report | Q2 2027 | Auditor |
| Type II report | Q4 2027 | Auditor |

## Tools evaluation (Phase 10)

- **Drata** — $7.5k–$15k/yr. Auto-evidence collection từ GitHub/Google Workspace/AWS.
- **Vanta** — $10k–$20k/yr. Tương tự Drata, market leader.
- **Secureframe** — $7k–$15k/yr. Good mid-market.
- **Self-managed (compliance-os + manual evidence)** — $0 trực tiếp nhưng
  tốn ~40h engineer/quarter để collect evidence.

Recommendation: Vanta (best UX, nhiều auditor network).

## Out of scope (this doc)

- HIPAA, PCI DSS, FedRAMP — chỉ apply nếu customer yêu cầu cụ thể.
- ISO 27001 — nhiều overlap với SOC 2, có thể bundle ở Phase 10.
- HITRUST — healthcare-specific, defer.
