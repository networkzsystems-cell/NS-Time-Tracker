/*
# Add domain column to candidates table

1. Purpose
   Adds a "Domain" field to each candidate so the reception desk can record
   the candidate's technical domain (Networking, Python, Electronics, .Net)
   alongside their existing details.

2. Modified Tables
   - `candidates`
     - `domain` (text, NOT NULL, default 'Networking') — the candidate's
       technical domain. Constrained to one of: Networking, Python,
       Electronics, .Net.

3. Security
   - No RLS changes. Existing anon + authenticated CRUD policies on
     `candidates` already cover the new column (they are not column-scoped).

4. Notes
   - The column is added with `IF NOT EXISTS` so the migration is idempotent.
   - A CHECK constraint enforces the allowed domain values.
   - Existing rows default to 'Networking' so they remain valid.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'domain'
  ) THEN
    ALTER TABLE candidates ADD COLUMN domain text NOT NULL DEFAULT 'Networking';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_domain_check'
  ) THEN
    ALTER TABLE candidates
      ADD CONSTRAINT candidates_domain_check
      CHECK (domain IN ('Networking', 'Python', 'Electronics', '.Net'));
  END IF;
END $$;