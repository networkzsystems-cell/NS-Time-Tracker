/*
# Add feedback column + atomic token generation function

1. Purpose
   - Adds a `feedback` column to `time_entries` to store the Valuation
     department's shortlist decision ("Shortlisted" / "Not Shortlisted").
   - Creates a SECURITY DEFINER function `generate_candidate_code` that
     atomically generates the next sequential candidate code (F## or E##)
     using a Postgres sequence per category prefix, making concurrent
     multi-device inserts collision-free.

2. Modified Tables
   - `time_entries`
     - `feedback` (text, nullable) — stores the valuation feedback status.
       Constrained to 'Shortlisted' or 'Not Shortlisted'.

3. New Objects
   - Sequence `fresher_code_seq` — backs Fresher code generation.
   - Sequence `experienced_code_seq` — backs Experienced code generation.
   - Function `generate_candidate_code(p_category text)` — returns next code.
     SECURITY DEFINER so anon/authenticated roles can call it without
     direct sequence access.

4. Security
   - The function is SECURITY DEFINER and callable by anon, authenticated.
   - No RLS changes needed; existing policies cover the new nullable column.
*/

-- 1. Add feedback column to time_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'feedback'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN feedback text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_feedback_check'
  ) THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT time_entries_feedback_check
      CHECK (feedback IS NULL OR feedback IN ('Shortlisted', 'Not Shortlisted'));
  END IF;
END $$;

-- 2. Create sequences for atomic code generation
CREATE SEQUENCE IF NOT EXISTS fresher_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS experienced_code_seq START WITH 1 INCREMENT BY 1;

-- 3. Create atomic code generation function
CREATE OR REPLACE FUNCTION generate_candidate_code(p_category text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq_val bigint;
  v_prefix text;
  v_code text;
BEGIN
  IF p_category = 'Fresher' THEN
    v_prefix := 'F';
    v_seq_val := nextval('fresher_code_seq');
  ELSIF p_category = 'Experienced' THEN
    v_prefix := 'E';
    v_seq_val := nextval('experienced_code_seq');
  ELSE
    RAISE EXCEPTION 'Invalid category: %', p_category;
  END IF;

  v_code := v_prefix || lpad(v_seq_val::text, 2, '0');

  -- Ensure code doesn't already exist (handles pre-sequence rows)
  WHILE EXISTS (SELECT 1 FROM candidates WHERE code = v_code) LOOP
    v_seq_val := nextval(
      CASE WHEN p_category = 'Fresher' THEN 'fresher_code_seq' ELSE 'experienced_code_seq' END
    );
    v_code := v_prefix || lpad(v_seq_val::text, 2, '0');
  END LOOP;

  RETURN v_code;
END;
$$;

-- 4. Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION generate_candidate_code(text) TO anon, authenticated;

-- 5. Sync sequences to existing data so they don't produce duplicate codes
DO $$
DECLARE
  max_f int;
  max_e int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 2) AS int)), 0) INTO max_f
  FROM candidates
  WHERE code ~ '^F[0-9]+$' AND category = 'Fresher';

  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 2) AS int)), 0) INTO max_e
  FROM candidates
  WHERE code ~ '^E[0-9]+$' AND category = 'Experienced';

  IF max_f > 0 THEN
    PERFORM setval('fresher_code_seq', max_f);
  END IF;
  IF max_e > 0 THEN
    PERFORM setval('experienced_code_seq', max_e);
  END IF;
END $$;