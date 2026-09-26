/*
# Create candidates registry table

1. Purpose
   Stores the reception desk's candidate registry for the NS Job Fair.
   Each row maps a candidate code (e.g. F01, F02, E01, E02) to the
   candidate's name, mobile number, place, and category (Fresher / Experienced).

2. New Tables
   - `candidates`
     - `id` (int8, primary key, auto-incrementing)
     - `code` (text, not null, unique) — short code like F01, E02
     - `name` (text, not null)
     - `mobile` (text, not null)
     - `place` (text, not null)
     - `category` (text, not null) — 'Fresher' or 'Experienced'
     - `created_at` (timestamptz, defaults to now)

3. Security
   - Enable RLS on `candidates`.
   - The app has no Supabase sign-in screen; the reception login is a
     client-side gate. The table is intentionally shared among desk staff,
     so anon + authenticated CRUD is allowed (single-tenant, public/shared data).
*/
CREATE TABLE IF NOT EXISTS candidates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  mobile text NOT NULL,
  place text NOT NULL,
  category text NOT NULL CHECK (category IN ('Fresher', 'Experienced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_candidates" ON candidates;
CREATE POLICY "anon_select_candidates" ON candidates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_candidates" ON candidates;
CREATE POLICY "anon_insert_candidates" ON candidates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_candidates" ON candidates;
CREATE POLICY "anon_update_candidates" ON candidates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_candidates" ON candidates;
CREATE POLICY "anon_delete_candidates" ON candidates FOR DELETE
  TO anon, authenticated USING (true);