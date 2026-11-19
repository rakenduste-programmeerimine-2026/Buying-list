#!/usr/bin/env bash
# Käivitab RLS ja piirangute testid ajutises andmebaasis.
#   PGHOST=... PGPORT=... PGUSER=postgres backend/supabase/tests/run.sh
# Vajab Postgres'i (14+). Päris Supabase'i projekti EI puuduta.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="rls_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/00_supabase_stub.sql
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f sql/01_constraints.sql
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f sql/02_rls_auth.sql
psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/10_rls.test.sql
