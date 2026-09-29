/*
# Add hierarchy and routing fields to access_requests

## Purpose
Expands the access request form to support hierarchical location selectors
(Company, Region, Facility) and an automated admin routing engine that
directs each submitted request to the appropriate admin tier based on the
requested scope.

## Changes to `access_requests` table
1. New columns (all nullable, additive — no existing data is lost):
   - `region` (text) — Geographic region selected by the requester
     (West Coast, Midwest, East Coast, South, National/Global).
   - `location_facility` (text) — Specific facility/location within the
     selected region, or "All Locations" for region-wide or company-wide
     scope.
   - `role_requested` (text) — The portal role the requester is applying
     for (Safety Manager, HR/Legal, Claims Adjuster, Regional Director).
   - `routing_target` (text) — Automatically computed routing destination
     indicating which admin tier should review the request
     ("Local Location Admin", "Regional Director", or "Super Admin").

## Security
- No changes to RLS policies. Existing anon/authenticated CRUD policies
  on `access_requests` remain in effect and cover the new columns
  automatically since they are on the same table.
- No new tables created.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'region'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN region text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'location_facility'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN location_facility text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'role_requested'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN role_requested text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'routing_target'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN routing_target text;
  END IF;
END $$;
