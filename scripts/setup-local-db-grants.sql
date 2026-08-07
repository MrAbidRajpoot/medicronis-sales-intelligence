-- Fix ownership/permissions on medicronis DB (PostgreSQL 15+ public schema defaults).
-- Run as postgres superuser, connected to medicronis database.

ALTER SCHEMA public OWNER TO medicronis;
GRANT ALL ON SCHEMA public TO medicronis;
GRANT CREATE ON SCHEMA public TO medicronis;
