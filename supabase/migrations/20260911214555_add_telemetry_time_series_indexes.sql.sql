/*
# Time-Series Telemetry Optimization

## Purpose
Optimizes the existing `telemetry_events` table for high-frequency time-series queries
(telemetry ingestion, C55 77GHz radar distance readings, ultrasonic proximity alerts,
speed telemetry) without requiring TimescaleDB. Uses PostgreSQL native indexing strategies
that replicate hypertable query performance.

## Changes

### 1. New column: `ts_us` (microsecond timestamp)
- `ts_us` is a `bigint` storing microsecond-precision Unix timestamps (epoch microseconds).
- Populated automatically from `utc_timestamp` via a trigger so inserts don't need to set it.
- Enables sub-millisecond time-windowed queries and ordered scans.

### 2. Composite indexes for time-windowed lookups
- `idx_telemetry_vehicle_time` — (vehicle_id, utc_timestamp DESC) — the primary
  query path: "get telemetry for vehicle X in time window Y."
- `idx_telemetry_company_time` — (company_id, utc_timestamp DESC) — fleet-wide
  time-windowed analytics.
- `idx_telemetry_vehicle_tsus` — (vehicle_id, ts_us DESC) — microsecond-precision
  time-windowed scans for high-frequency sensor streams.
- `idx_telemetry_sensor_type_time` — (sensor_type, utc_timestamp DESC) — filter
  by sensor type (radar, ultrasonic, speed) across time windows.

### 3. Trigger: `trg_telemetry_ts_us`
- BEFORE INSERT/UPDATE trigger that auto-populates `ts_us` from `EXTRACT(EPOCH FROM utc_timestamp) * 1000000`.

### 4. Query function: `fn_telemetry_time_window`
- SECURITY DEFINER function that returns telemetry rows for a vehicle within a
  time window, ordered by timestamp descending. Uses the composite index for O(log n) lookup.

## Security
- No changes to existing RLS policies (already has full CRUD for anon + authenticated).
- The new `fn_telemetry_time_window` runs as SECURITY DEFINER but only performs
  a SELECT, so it doesn't escalate privileges beyond what RLS already allows.
- No new tables created — all changes are additive to the existing `telemetry_events` table.
*/

-- 1. Add microsecond timestamp column
ALTER TABLE telemetry_events
  ADD COLUMN IF NOT EXISTS ts_us bigint;

-- 2. Backfill existing rows from utc_timestamp
UPDATE telemetry_events
  SET ts_us = EXTRACT(EPOCH FROM utc_timestamp) * 1000000
  WHERE ts_us IS NULL;

-- 3. Create composite indexes for time-series query optimization
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_time
  ON telemetry_events (vehicle_id, utc_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_company_time
  ON telemetry_events (company_id, utc_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_tsus
  ON telemetry_events (vehicle_id, ts_us DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_type_time
  ON telemetry_events (sensor_type, utc_timestamp DESC);

-- 4. Trigger function to auto-populate ts_us from utc_timestamp
CREATE OR REPLACE FUNCTION trg_fn_telemetry_ts_us()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.utc_timestamp IS NOT NULL THEN
    NEW.ts_us := EXTRACT(EPOCH FROM NEW.utc_timestamp) * 1000000;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_telemetry_ts_us ON telemetry_events;
CREATE TRIGGER trg_telemetry_ts_us
  BEFORE INSERT OR UPDATE OF utc_timestamp ON telemetry_events
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_telemetry_ts_us();

-- 5. Time-windowed query function for high-frequency telemetry lookups
CREATE OR REPLACE FUNCTION fn_telemetry_time_window(
  p_vehicle_id uuid,
  p_start timestamptz DEFAULT now() - interval '1 hour',
  p_end timestamptz DEFAULT now(),
  p_limit int DEFAULT 500
)
RETURNS SETOF telemetry_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM telemetry_events
  WHERE vehicle_id = p_vehicle_id
    AND utc_timestamp >= p_start
    AND utc_timestamp <= p_end
  ORDER BY utc_timestamp DESC
  LIMIT p_limit;
$$;
