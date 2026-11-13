-- Supabase security advisor (rls_disabled_in_public): Supabase serves the public schema through its REST API
-- (PostgREST) to the anon and authenticated roles. The app never uses that API; it connects as postgres, which
-- bypasses row level security, so turning RLS on with no policies closes the REST API and changes nothing for
-- Prisma. Postgres only (SQLite has no RLS). A new table needs the same line in its own migration.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
