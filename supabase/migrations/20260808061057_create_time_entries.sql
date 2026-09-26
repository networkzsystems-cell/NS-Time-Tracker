/*
# Create time_entries table (single-tenant, no auth)

1. Purpose
- Stores session timer entries for the NSP Time Tracker app.
- Multiple department heads access the same shared table simultaneously
  and log task durations using a Start/Stop timer.

2. New Table: time_entries
- id (bigserial, primary key, auto-increment) — unique row identifier.
- user_email (text, not null) — email of the department head who logged the session.
- department (text, not null) — preset department selected from a dropdown.
- task_code (text, not null) — free-text session/task code entered by the user.
- start_time (timestamptz, not null) — UTC timestamp when the session started.
- stop_time (timestamptz, nullable) — UTC timestamp when the session stopped; null while running.
- duration_minutes (integer, nullable) — elapsed minutes between start and stop; null while running.
- created_at (timestamptz, default now()) — row creation timestamp for ordering.

3. Indexes
- idx_time_entries_created_at — descending order for recent-logs queries.
- idx_time_entries_user_email — per-user lookups.

4. Security
- Enable RLS on time_entries.
- This is a no-auth app: department heads enter their email manually with no sign-in.
  The frontend uses the anon key for its entire lifetime, so policies MUST allow anon.
- CRUD is intentionally shared/public across all users (anon + authenticated).

5. Notes
- stop_time and duration_minutes are NULL while a session is running; the app
  shows "Running..." for those rows and computes live elapsed time from start_time.
- duration_minutes is computed by the app on Stop and written back to the row.
*/

CREATE TABLE IF NOT EXISTS time_entries (
  id bigserial PRIMARY KEY,
  user_email text NOT NULL,
  department text NOT NULL,
  task_code text NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  stop_time timestamptz,
  duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_time_entries_created_at ON time_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_email ON time_entries (user_email);

DROP POLICY IF EXISTS "anon_select_time_entries" ON time_entries;
CREATE POLICY "anon_select_time_entries"
ON time_entries FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_time_entries" ON time_entries;
CREATE POLICY "anon_insert_time_entries"
ON time_entries FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_time_entries" ON time_entries;
CREATE POLICY "anon_update_time_entries"
ON time_entries FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_time_entries" ON time_entries;
CREATE POLICY "anon_delete_time_entries"
ON time_entries FOR DELETE
TO anon, authenticated USING (true);
