-- Drop old constraint first
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_domain_check;

-- Migrate any existing rows with old domain values
UPDATE candidates SET domain = 'Civil' WHERE domain NOT IN ('Civil', 'Mechanical', 'Commerce');

-- Add new constraint
ALTER TABLE candidates
  ADD CONSTRAINT candidates_domain_check
  CHECK (domain IN ('Civil', 'Mechanical', 'Commerce'));