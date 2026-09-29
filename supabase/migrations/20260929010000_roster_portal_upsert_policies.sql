/*
  Ensure roster portal token upsert works for welcome email + portal links.
*/
DROP POLICY IF EXISTS "anon_upsert_all_roster_tokens" ON roster_portal_tokens;
CREATE POLICY "anon_upsert_all_roster_tokens" ON roster_portal_tokens
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_upsert_all_roster_entries" ON roster_portal_entries;
CREATE POLICY "anon_upsert_all_roster_entries" ON roster_portal_entries
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
