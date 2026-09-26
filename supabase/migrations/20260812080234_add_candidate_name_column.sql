/*
# Add candidate_name column to time_entries

1. Purpose
- The NSP Time Tracker now supports concurrent multi-timer management where
  each active timer tracks a specific candidate. A candidate name field is
  required so each timer card can display who is being tracked.

2. Modified Table: time_entries
- Added column: candidate_name (text, nullable)
  - Nullable so existing rows (created before this column existed) remain valid.
  - New inserts from the multi-timer UI will always provide a candidate_name.
  - A backfill sets existing rows to 'Unknown' for cleaner display in the logs.

3. Index
- idx_time_entries_candidate_name — per-candidate lookups.

4. Security
- No RLS policy changes. The table remains shared/public (anon + authenticated)
  as established in the original migration.

5. Notes
- No data is lost. The column is added, not removed or renamed.
- Existing rows are backfilled with 'Unknown' for candidate_name.
*/

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS candidate_name text;

UPDATE time_entries
  SET candidate_name = 'Unknown'
  WHERE candidate_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_candidate_name
  ON time_entries (candidate_name);
