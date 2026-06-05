-- infra/docker/postgres/init.sql — I-008
-- Bootstrap extensions + roles khi container postgres lần đầu start.
-- Chạy 1 lần duy nhất (entrypoint /docker-entrypoint-initdb.d/).

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 2 roles theo ADR-0003 + ADR-0014
--   app_runtime         → enforce RLS, dùng cho tất cả service runtime
--   app_platform_owner  → BYPASSRLS, chỉ dùng cho checkin-admin workflow có audit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'app_runtime_dev'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform_owner') THEN
    CREATE ROLE app_platform_owner LOGIN PASSWORD 'app_platform_owner_dev'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- Database-level settings
ALTER DATABASE saas_checkin SET app.current_tenant = '';
ALTER DATABASE saas_checkin SET log_min_duration_statement = 200;
