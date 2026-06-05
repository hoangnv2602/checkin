/**
 * tools/seed/seed.ts — I-010
 *
 * Seed data mẫu cho dev environment:
 *   - 1 organization
 *   - 1 owner user
 *   - 1 event draft
 *   - 100 registration
 *
 * Chạy qua `task db:seed` (Taskfile.yml).
 *
 * Kết nối trực tiếp Postgres (port 5432) bằng pg client.
 * KHÔNG qua BFF / .NET — seed chạy ngoài service.
 */

import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const PG_CONFIG = {
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
  database: process.env.POSTGRES_DB ?? 'saas_checkin',
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_USER_ID = '00000000-0000-0000-0000-0000000000a1';
const EVENT_ID = '00000000-0000-0000-0000-0000000000b1';
const REGISTRATION_COUNT = 100;

async function main() {
  const client = new Client(PG_CONFIG);
  await client.connect();

  console.log('→ Seeding dev data…');

  // 1. Organization (tenant)
  await client.query(
    `INSERT INTO organizations (id, name, slug, plan, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [TENANT_ID, 'Acme Events', 'acme', 'pro']
  );

  // 2. Owner user (global, không thuộc tenant)
  await client.query(
    `INSERT INTO users (id, email, full_name, email_verified_at, created_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [OWNER_USER_ID, 'owner@acme.test', 'Alice Owner']
  );

  // 3. Membership (user ↔ tenant ↔ role)
  await client.query(
    `INSERT INTO memberships (id, tenant_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [randomUUID(), TENANT_ID, OWNER_USER_ID, 'owner', 'active']
  );

  // 4. Event draft
  await client.query(
    `INSERT INTO events (id, tenant_id, name, slug, status, starts_at, venue_name, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days', $6, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [EVENT_ID, TENANT_ID, 'Acme Conf 2026', 'acme-conf-2026', 'draft', 'Acme HQ']
  );

  // 5. 100 registration giả
  console.log(`→ Inserting ${REGISTRATION_COUNT} registrations…`);
  for (let i = 0; i < REGISTRATION_COUNT; i++) {
    const regId = randomUUID();
    const attendeeId = randomUUID();

    await client.query(
      `INSERT INTO users (id, email, full_name, email_verified_at, created_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [attendeeId, `attendee${i}@example.test`, `Attendee ${i}`]
    );

    await client.query(
      `INSERT INTO registrations (id, tenant_id, event_id, attendee_user_id, status, qr_jti, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [regId, TENANT_ID, EVENT_ID, attendeeId, 'confirmed', randomUUID()]
    );
  }

  console.log('✓ Seed done');
  console.log(`   Tenant: ${TENANT_ID}`);
  console.log(`   Owner:  ${OWNER_USER_ID}`);
  console.log(`   Event:  ${EVENT_ID}`);
  console.log(`   Registrations: ${REGISTRATION_COUNT}`);

  await client.end();
}

main().catch((err) => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
