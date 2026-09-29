-- Add fleet_locations array to companies for custom tenant-registered locations
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fleet_locations jsonb DEFAULT '[]'::jsonb;
