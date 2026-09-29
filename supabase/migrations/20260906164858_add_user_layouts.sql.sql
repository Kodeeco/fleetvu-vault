/*
# User Dashboard Layout Preferences

## Overview
Stores per-user custom dashboard widget ordering so that admins/super-admins
can drag-and-drop reorder dashboard widgets and have their arrangement persist
across logins.

## New Tables
1. `user_layouts`
   - `id` (uuid, primary key)
   - `user_email` (text, unique) — identifies the user by their login email
   - `user_role` (text) — the role at time of save (super_admin, global_admin, executive, driver)
   - `widget_order` (jsonb) — ordered array of widget IDs defining the grid arrangement
   - `layout_config` (jsonb) — additional layout preferences (visibility, zoom, etc.)
   - `updated_at` (timestamptz)
   - `created_at` (timestamptz)

## Security
- RLS enabled on `user_layouts`.
- Policies for `anon, authenticated` CRUD (single-tenant demo app; the anon-key
  client needs full access to read and write layout preferences).
*/

CREATE TABLE IF NOT EXISTS user_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text UNIQUE NOT NULL,
  user_role text,
  widget_order jsonb DEFAULT '[]'::jsonb,
  layout_config jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_user_layouts" ON user_layouts;
CREATE POLICY "anon_select_user_layouts" ON user_layouts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_user_layouts" ON user_layouts;
CREATE POLICY "anon_insert_user_layouts" ON user_layouts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_user_layouts" ON user_layouts;
CREATE POLICY "anon_update_user_layouts" ON user_layouts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_user_layouts" ON user_layouts;
CREATE POLICY "anon_delete_user_layouts" ON user_layouts FOR DELETE
  TO anon, authenticated USING (true);
