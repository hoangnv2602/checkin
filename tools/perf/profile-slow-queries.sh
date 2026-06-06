#!/usr/bin/env bash
# tools/perf/profile-slow-queries.sh — I-704 pg_stat_statements profiler
set -euo pipefail

PG_HOST=${PG_HOST:-htz-db-staging}
PG_USER=${PG_USER:-postgres}
PG_DB=${PG_DB:-saas_checkin}

psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" <<'SQL'
\echo '=== Top 20 slow queries (mean exec time) ==='
SELECT
  substring(query, 1, 200) AS query_sample,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct_total
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

\echo ''
\echo '=== Top 20 by total time ==='
SELECT
  substring(query, 1, 200) AS query_sample,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct_total
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

\echo ''
\echo '=== Index usage stats (unused indexes) ==='
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan < 50
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

\echo ''
\echo '=== Connection pool state ==='
SELECT
  state,
  count(*) AS connections,
  count(*) FILTER (WHERE application_name LIKE '%api-gateway%') AS api_gateway,
  count(*) FILTER (WHERE application_name LIKE '%core-api%') AS core_api
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;
SQL
