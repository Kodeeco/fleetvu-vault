/*
# Add trial metadata fields to provisioned_users

1. Modified Tables
- `provisioned_users`
  - `trial_start_date` (timestamptz, nullable) — when the 30-day full-feature trial begins (set on first login or at provisioning time)
  - `trial_duration_days` (integer, nullable, default 30) — how many days the trial lasts before automatic feature shut-off

2. Security
- No RLS policy changes. Existing policies on provisioned_users remain unchanged.
- These columns are set by admins during provisioning and read by the app to evaluate trial state.

3. Notes
- Both columns are nullable so existing provisioned users are unaffected.
- When `trial_start_date` is NULL, the user is not in trial mode.
- When `trial_start_date` is set, the app computes `trial_end = trial_start_date + trial_duration_days` and checks whether the current time is before that end date.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provisioned_users' AND column_name = 'trial_start_date'
  ) THEN
    ALTER TABLE provisioned_users ADD COLUMN trial_start_date timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provisioned_users' AND column_name = 'trial_duration_days'
  ) THEN
    ALTER TABLE provisioned_users ADD COLUMN trial_duration_days integer DEFAULT 30;
  END IF;
END $$;
