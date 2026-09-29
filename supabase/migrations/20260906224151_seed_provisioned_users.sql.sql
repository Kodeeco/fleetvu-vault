/*
  Seed demo companies + provisioned users for the dashboard widget.
  Companies are inserted first so provisioned_users FK constraints succeed
  on a clean/reset database.
  Note: fleet_locations is added in a later migration — do not reference it here.
*/

INSERT INTO companies (id, name, region, location, plan_tier)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Apex Logistics', 'South', 'Houston, TX', 'pro'),
  ('a0000000-0000-0000-0000-000000000002', 'Summit Freight Co.', 'West Coast', 'Los Angeles, CA', 'pro'),
  ('a0000000-0000-0000-0000-000000000003', 'Coastal Hauling', 'East Coast', 'Miami, FL', 'basic')
ON CONFLICT (id) DO NOTHING;

-- Role check: admin/manager/standard_user. Status check: active/suspended/revoked.
INSERT INTO provisioned_users (full_name, email, role, status, company_id, company_name, corporate_title, plan_tier, provisioned_by, provisioned_by_role)
VALUES
  ('Marcus Webb', 'marcus.webb@apexlogistics.com', 'standard_user', 'active', 'a0000000-0000-0000-0000-000000000001', 'Apex Logistics', 'Driver', 'pro', 'system', 'super_admin'),
  ('Sarah Chen', 'sarah.chen@summitfreight.com', 'admin', 'active', 'a0000000-0000-0000-0000-000000000002', 'Summit Freight Co.', 'Fleet Admin', 'pro', 'system', 'super_admin'),
  ('James Rivera', 'james.rivera@coastalhauling.com', 'standard_user', 'suspended', 'a0000000-0000-0000-0000-000000000003', 'Coastal Hauling', 'Driver', 'basic', 'system', 'super_admin')
ON CONFLICT DO NOTHING;
