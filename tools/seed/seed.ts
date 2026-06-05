/**
 * tools/seed/seed.ts — I-104
 *
 * Seed data idempotent cho dev environment (mirror SaasCheckin.DbMigrator seed).
 * Chạy qua `task db:seed` (Taskfile.yml) hoặc `pnpm --filter @saas-checkin/seed seed`.
 *
 * Phase 1 schema: organizations, users, memberships (Phase 0 stub tables dropped).
 * Kết nối trực tiếp Postgres (port 5434) bằng pg client với role postgres
 * (RLS bypass để idempotent check cross-tenant rows).
 * KHÔNG qua BFF / .NET — seed chạy ngoài service.
 *
 * Lưu ý: cùng IDs với SaasCheckin.DbMigrator seed để 2 tool không conflict.
 */

import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const PG_CONFIG = {
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5434),
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  database: process.env.POSTGRES_DB ?? 'saas_checkin',
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_USER_ID = '00000000-0000-0000-0000-0000000000a1';

async function main(): Promise<void> {
  const client = new Client(PG_CONFIG);
  await client.connect();

  console.log('→ Seeding dev data (Phase 1 schema)…');

  // 1. Organization
  await client.query(
    `INSERT INTO organizations (id, name, slug, default_locale, default_currency, timezone, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [TENANT_ID, 'Acme Events', 'acme', 'vi', 'VND', 'Asia/Ho_Chi_Minh']
  );
  console.log('  ✓ Organization acme');

  // 2. Owner user
  await client.query(
    `INSERT INTO users (id, email, full_name, email_verified_at, password_hash, locale, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [OWNER_USER_ID, 'alice@acme.test', 'Alice Nguyễn', '$2a$12$placeholder', 'vi']
  );
  console.log('  ✓ Owner user alice@acme.test (password_hash placeholder)');

  // 3. Membership
  await client.query(
    `INSERT INTO memberships (id, tenant_id, user_id, role, status, invited_at, joined_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [randomUUID(), TENANT_ID, OWNER_USER_ID, 'Owner', 1]
  );
  console.log('  ✓ Membership alice → acme (Owner)');

  console.log('');
  console.log('✓ Seed done');
  console.log(`   Tenant:    ${TENANT_ID}`);
  console.log(`   Owner:     ${OWNER_USER_ID}`);
  console.log('');
  console.log('⚠ Lưu ý: tools/seed/seed.ts chỉ tạo placeholders.');
  console.log('  Để có password hash thật, chạy `dotnet run --project apps/core-api/src/SaasCheckin.DbMigrator`.');
  console.log('  Idempotent — chạy 2 lần liên tiếp sẽ skip tất cả row đã tồn tại.');

  await client.end();
}

main().catch((err) => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
