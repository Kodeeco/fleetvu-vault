/*
# Add CRM fields to companies table

## Purpose
Transforms the companies table from a basic org registry into a full CRM record
supporting contract lifecycle management, billing/revenue tracking, account health,
and sales pipeline management for FleetVu internal staff.

## New Columns on `companies`
1. `account_status` (text) — Lifecycle stage: 'prospect', 'trial', 'active', 'churned', 'suspended'
2. `contract_start_date` (date) — When the client's contract begins
3. `contract_end_date` (date) — When the client's contract ends
4. `plan_start_date` (date) — When the current plan billing cycle starts
5. `plan_end_date` (date) — When the current plan billing cycle ends
6. `trial_start_date` (date) — When the trial period begins (if applicable)
7. `trial_end_date` (date) — When the trial period ends
8. `monthly_recurring_revenue` (numeric) — MRR in USD
9. `annual_contract_value` (numeric) — ACV in USD
10. `billing_cycle` (text) — 'monthly', 'annual', 'quarterly'
11. `payment_status` (text) — 'current', 'past_due', 'none', 'comped'
12. `sales_rep` (text) — FleetVu staff who owns the account
13. `industry` (text) — Client's industry vertical
14. `fleet_size` (integer) — Number of vehicles in their fleet
15. `notes` (text) — Internal CRM notes
16. `renewal_status` (text) — 'auto_renew', 'manual', 'cancel_pending', 'renewed'
17. `health_score` (integer) — 0-100 account health score
18. `last_activity_at` (timestamptz) — Last client activity timestamp

## Security
- No new tables created.
- No RLS policy changes — companies already has anon+authenticated CRUD policies.

## Notes
1. All columns are nullable with sensible defaults so existing rows are not affected.
2. `account_status` defaults to 'active' for existing rows.
3. `billing_cycle` defaults to 'monthly'.
4. `payment_status` defaults to 'none'.
5. `renewal_status` defaults to 'manual'.
6. `health_score` defaults to 80.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'account_status') THEN
    ALTER TABLE companies ADD COLUMN account_status text DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'contract_start_date') THEN
    ALTER TABLE companies ADD COLUMN contract_start_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'contract_end_date') THEN
    ALTER TABLE companies ADD COLUMN contract_end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'plan_start_date') THEN
    ALTER TABLE companies ADD COLUMN plan_start_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'plan_end_date') THEN
    ALTER TABLE companies ADD COLUMN plan_end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'trial_start_date') THEN
    ALTER TABLE companies ADD COLUMN trial_start_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'trial_end_date') THEN
    ALTER TABLE companies ADD COLUMN trial_end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'monthly_recurring_revenue') THEN
    ALTER TABLE companies ADD COLUMN monthly_recurring_revenue numeric(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'annual_contract_value') THEN
    ALTER TABLE companies ADD COLUMN annual_contract_value numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'billing_cycle') THEN
    ALTER TABLE companies ADD COLUMN billing_cycle text DEFAULT 'monthly';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'payment_status') THEN
    ALTER TABLE companies ADD COLUMN payment_status text DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'sales_rep') THEN
    ALTER TABLE companies ADD COLUMN sales_rep text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'industry') THEN
    ALTER TABLE companies ADD COLUMN industry text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'fleet_size') THEN
    ALTER TABLE companies ADD COLUMN fleet_size integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'notes') THEN
    ALTER TABLE companies ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'renewal_status') THEN
    ALTER TABLE companies ADD COLUMN renewal_status text DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'health_score') THEN
    ALTER TABLE companies ADD COLUMN health_score integer DEFAULT 80;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'last_activity_at') THEN
    ALTER TABLE companies ADD COLUMN last_activity_at timestamptz;
  END IF;
END $$;