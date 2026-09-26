-- Drop old constraint first
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_domain_check;

-- Migrate any existing rows with old domain values
UPDATE candidates SET domain = 'Python' WHERE domain NOT IN ('Python', 'Networking', '.Net', 'Digital marketing');

-- Add new constraint
ALTER TABLE candidates
  ADD CONSTRAINT candidates_domain_check
  CHECK (domain IN ('Python', 'Networking', '.Net', 'Digital marketing'));