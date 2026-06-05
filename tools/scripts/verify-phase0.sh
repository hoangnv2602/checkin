#!/usr/bin/env bash
# tools/scripts/verify-phase0.sh
#
# Verify Phase 0 foundation — check từng app có file config + structure đúng.
# KHÔNG chạy build thật (cần SDK thật). Chỉ verify skeleton tồn tại.
#
# Usage: bash tools/scripts/verify-phase0.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
SKIP=0

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
skip() { echo "  ⊙ $1 (skipped)"; SKIP=$((SKIP+1)); }

# ── 1. Monorepo layout ─────────────────────────────────────
echo "── 1. Monorepo layout ──"
for d in apps/web apps/checkin-admin apps/mobile apps/api-gateway apps/core-api; do
  [ -d "$d" ] && ok "$d/ exists" || fail "$d/ missing"
done
for d in packages/contracts packages/proto/checkin packages/proto/identity; do
  [ -d "$d" ] && ok "$d/ exists" || fail "$d/ missing"
done
for f in pnpm-workspace.yaml turbo.json melos.yaml Taskfile.yml; do
  [ -f "$f" ] && ok "$f exists" || fail "$f missing"
done

# ── 2. Root config ─────────────────────────────────────────
echo "── 2. Root config ──"
for f in package.json .gitignore .editorconfig .nvmrc LICENSE CODEOWNERS README.md CLAUDE.md; do
  [ -f "$f" ] && ok "$f exists" || fail "$f missing"
done

# ── 3. CI/CD ───────────────────────────────────────────────
echo "── 3. CI/CD ──"
for f in .github/workflows/ci.yml .github/workflows/release.yml .github/dependabot.yml; do
  [ -f "$f" ] && ok "$f exists" || fail "$f missing"
done

# ── 4. Dev env ─────────────────────────────────────────────
echo "── 4. Dev env ──"
[ -f infra/docker/docker-compose.dev.yml ] && ok "docker-compose.dev.yml" || fail "missing"
[ -f infra/docker/postgres/init.sql ] && ok "postgres init.sql" || fail "missing"
[ -f infra/docker/.env.example ] && ok "docker .env.example" || fail "missing"

# ── 5. Skeleton apps ───────────────────────────────────────
echo "── 5. Skeleton apps ──"

# apps/web
[ -f apps/web/package.json ] && ok "apps/web/package.json" || fail "missing"
[ -f apps/web/src/app/layout.tsx ] && ok "apps/web/src/app/layout.tsx" || fail "missing"
[ -f apps/web/src/app/globals.css ] && ok "apps/web/src/app/globals.css" || fail "missing"
[ -f apps/web/src/app/api/health/route.ts ] && ok "apps/web health route" || fail "missing"
[ -d apps/web/src/modules/marketing ] && ok "apps/web module: marketing" || fail "missing"

# apps/checkin-admin
[ -f apps/checkin-admin/package.json ] && ok "apps/checkin-admin/package.json" || fail "missing"
[ -f apps/checkin-admin/src/middleware.ts ] && ok "checkin-admin middleware" || fail "missing"
[ -f apps/checkin-admin/src/app/\(auth\)/login/page.tsx ] && ok "checkin-admin login" || fail "missing"
[ -f apps/checkin-admin/src/app/\(dashboard\)/tenants/page.tsx ] && ok "checkin-admin tenants" || fail "missing"

# apps/api-gateway
[ -f apps/api-gateway/package.json ] && ok "apps/api-gateway/package.json" || fail "missing"
[ -f apps/api-gateway/src/main.ts ] && ok "api-gateway main.ts" || fail "missing"
[ -d apps/api-gateway/src/modules/health ] && ok "api-gateway health module" || fail "missing"

# apps/core-api
[ -f apps/core-api/SaasCheckin.sln ] && ok "core-api sln" || fail "missing"
[ -f apps/core-api/global.json ] && ok "core-api global.json" || fail "missing"
[ -f apps/core-api/Directory.Build.props ] && ok "Directory.Build.props" || fail "missing"
[ -f apps/core-api/Directory.Packages.props ] && ok "Directory.Packages.props" || fail "missing"
[ -f apps/core-api/src/SaasCheckin.HttpApi.Host/Program.cs ] && ok "core-api Program.cs" || fail "missing"
[ -f apps/core-api/src/SaasCheckin.Domain/Identity/Aggregates/User.cs ] && ok "User aggregate" || fail "missing"
[ -f apps/core-api/src/SaasCheckin.Domain/Identity/Authorization/Permissions.cs ] && ok "Identity Permissions" || fail "missing"
[ -f apps/core-api/src/SaasCheckin.Domain/Identity/Authorization/RolePermissionMap.cs ] && ok "RolePermissionMap" || fail "missing"

# apps/mobile
[ -f apps/mobile/pubspec.yaml ] && ok "mobile pubspec" || fail "missing"
[ -f apps/mobile/lib/main.dart ] && ok "mobile main.dart" || fail "missing"
[ -f apps/mobile/lib/app.dart ] && ok "mobile app.dart" || fail "missing"
[ -f apps/mobile/lib/features/auth/presentation/blocs/session_cubit.dart ] && ok "SessionCubit" || fail "missing"
[ -f apps/mobile/lib/features/checkin/presentation/blocs/scan_bloc.dart ] && ok "ScanBloc" || fail "missing"

# ── 6. Contracts ───────────────────────────────────────────
echo "── 6. Contracts ──"
[ -f packages/proto/buf.yaml ] && ok "buf.yaml" || fail "missing"
[ -f packages/proto/buf.gen.yaml ] && ok "buf.gen.yaml" || fail "missing"
[ -f packages/proto/checkin/v1/checkin.proto ] && ok "checkin.proto" || fail "missing"
[ -f packages/proto/identity/v1/identity.proto ] && ok "identity.proto" || fail "missing"
[ -f packages/contracts/package.json ] && ok "contracts package.json" || fail "missing"

# ── 7. Provisioning ───────────────────────────────────────
echo "── 7. Provisioning ──"
[ -f infra/ansible/ansible.cfg ] && ok "ansible.cfg" || fail "missing"
[ -f infra/ansible/playbooks/staging.yml ] && ok "staging playbook" || fail "missing"
[ -f infra/hetzner/README.md ] && ok "hetzner README" || fail "missing"
[ -f infra/cloudflare/README.md ] && ok "cloudflare README" || fail "missing"
[ -f docs/runbooks/initial-deploy.md ] && ok "initial deploy runbook" || fail "missing"

# ── 8. Seed ────────────────────────────────────────────────
echo "── 8. Seed ──"
[ -f tools/seed/seed.ts ] && ok "seed.ts" || fail "missing"
[ -f tools/seed/package.json ] && ok "seed package.json" || fail "missing"

# ── Summary ────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════"
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo "  Skipped: $SKIP"
echo "═══════════════════════════════════════════════"
echo

if [ "$FAIL" -gt 0 ]; then
  echo "✗ Phase 0 incomplete — fix the $FAIL failures above"
  exit 1
fi

echo "✓ Phase 0 foundation verified."
echo
echo "Next steps:"
echo "  1. pnpm install                    # workspace install"
echo "  2. task dev:up                     # postgres + redis + mailhog + minio"
echo "  3. cd apps/web && pnpm dev         # web on :3000"
echo "  4. cd apps/checkin-admin && pnpm dev  # checkin-admin on :3002"
echo "  5. cd apps/api-gateway && pnpm dev    # BFF on :3001"
echo "  6. cd apps/core-api && dotnet run     # core-api on :5000"
echo "  7. cd apps/mobile && flutter run      # mobile (cần flutter SDK)"
echo
echo "Note: KHÔNG CẦN verify build thật cho Phase 0 — skeleton chỉ cần structure đúng."
echo "      Build verification sẽ là Definition of Done ở Phase 1+."
