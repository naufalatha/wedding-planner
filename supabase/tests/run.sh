#!/usr/bin/env bash
# Usage: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=wp_test_$$
psql -v ON_ERROR_STOP=1 -qc "create database $DB" postgres
trap 'psql -qc "drop database if exists $DB" postgres >/dev/null' EXIT
export PGDATABASE=$DB
psql -v ON_ERROR_STOP=1 -q -f tests/00_supabase_shim.sql
for f in migrations/*.sql; do echo "migrate $f"; psql -v ON_ERROR_STOP=1 -q -f "$f"; done
for f in tests/[1-9]*.sql; do echo "test    $f"; psql -v ON_ERROR_STOP=1 -q -f "$f"; done
echo "SEMUA TES SQL LOLOS"
