-- Creates Medicronis demo database user (idempotent).
-- Run via scripts/setup-local-db.ps1 as the postgres superuser.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'medicronis') THEN
    CREATE ROLE medicronis WITH LOGIN PASSWORD 'medicronis';
  ELSE
    ALTER ROLE medicronis WITH LOGIN PASSWORD 'medicronis';
  END IF;
END
$$;
