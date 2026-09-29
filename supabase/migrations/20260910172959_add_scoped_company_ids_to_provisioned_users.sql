-- Add scoped_company_ids to provisioned_users for multi-company super-admin provisioning
ALTER TABLE provisioned_users ADD COLUMN IF NOT EXISTS scoped_company_ids jsonb DEFAULT '[]'::jsonb;
