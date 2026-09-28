/*
# Create domains and app_settings tables

1. Purpose
   - `domains` table stores the editable list of candidate domains
     shown in the "Add candidate" form's Domain dropdown on the Reception
     desk page. Domains can be added, renamed, and removed from the
     Settings panel — the dropdown is no longer hardcoded.
   - `app_settings` table stores the reception login credentials
     (username + password) so they can be updated from the Settings panel
     instead of being hardcoded in the app source.

2. New Tables
   - `domains`
     - `id` (bigint, identity, primary key)
     - `name` (text, not null, unique) — the domain label shown in the dropdown
     - `created_at` (timestamptz, defaults to now)
   - `app_settings`
     - `id` (int, primary key, always 1 — singleton row)
     - `username` (text, not null)
     - `password` (text, not null)
     - `updated_at` (timestamptz, defaults to now)

3. Modified Tables
   - `candidates`: drops the `candidates_domain_check` CHECK constraint so
     the domain column accepts any text value managed dynamically from the
     domains table. The column itself is unchanged (text, not null).

4. Seed Data
   - Inserts the four current domains: Python, Networking, .Net, Digital marketing
   - Inserts the default credentials: username 'Reception', password 'NSPLOGIN'

5. Security
   - RLS enabled on both new tables.
   - Both tables are intentionally shared/public (single-tenant app with a
     client-side login gate, no Supabase auth). Anon + authenticated CRUD
     is allowed so the anon-key frontend can read and write.
*/

-- ── domains table ──
CREATE TABLE IF NOT EXISTS domains (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_domains" ON domains;
CREATE POLICY "anon_select_domains" ON domains FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_domains" ON domains;
CREATE POLICY "anon_insert_domains" ON domains FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_domains" ON domains;
CREATE POLICY "anon_update_domains" ON domains FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_domains" ON domains;
CREATE POLICY "anon_delete_domains" ON domains FOR DELETE
  TO anon, authenticated USING (true);

-- ── app_settings table (singleton) ──
CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1,
  username text NOT NULL,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Seed domains ──
INSERT INTO domains (name) VALUES
  ('Python'),
  ('Networking'),
  ('.Net'),
  ('Digital marketing')
ON CONFLICT (name) DO NOTHING;

-- ── Seed default credentials ──
INSERT INTO app_settings (id, username, password) VALUES
  (1, 'Reception', 'NSPLOGIN')
ON CONFLICT (id) DO NOTHING;

-- ── Drop the hardcoded domain CHECK constraint on candidates ──
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_domain_check;