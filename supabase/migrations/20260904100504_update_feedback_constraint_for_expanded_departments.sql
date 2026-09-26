/*
# Update feedback constraint for expanded department options
*/

-- Drop old constraint first
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_feedback_check;

-- Migrate old feedback values
UPDATE time_entries SET feedback = 'Below 70%' WHERE feedback = 'Shortlisted';
UPDATE time_entries SET feedback = 'Above 70%' WHERE feedback = 'Not Shortlisted';

-- Add new constraint with all valid values
ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_feedback_check
  CHECK (
    feedback IS NULL OR feedback IN (
      'Below 70%',
      'Above 70%',
      'Teaching Interested',
      'Course Interested',
      'Both',
      'N/A'
    )
  );