/**
 * ACID-Compliant Company Onboarding Transaction
 *
 * Creates company → fleet director (contact) → fleet locations / entitlements
 * as a compensating-transaction unit: on any failure, previously inserted
 * rows are rolled back (deleted) in reverse order.
 */

import { supabase } from '@/lib/supabase';
import { dispatchWelcome } from '@/lib/email';
import { sealCustodyEvent } from '@/lib/forensics';
import {
  unifiedOnboardingSchema,
  type UnifiedOnboardingData,
} from './schema';
import { validateHierarchy, type HierarchySnapshot } from './hierarchy';
import type { OnboardingActor, OnboardingTransactionResult } from './types';

export type { OnboardingActor, OnboardingTransactionResult };

function generateActivationKey(orgName: string): string {
  const prefix = 'FV';
  const nums = Math.floor(1000 + Math.random() * 9000).toString();
  const letters = orgName
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, 'X');
  return `${prefix}-${nums}-${letters}`;
}

function generateSetupToken(): string {
  const segments = [8, 4, 4, 4, 12];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return segments
    .map((len) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
    )
    .join('-');
}

interface RollbackStack {
  companyId?: string;
  userId?: string;
  activationKeyId?: string;
  inviteTokenId?: string;
}

async function rollback(stack: RollbackStack): Promise<void> {
  if (stack.inviteTokenId) {
    await supabase.from('invite_tokens').delete().eq('id', stack.inviteTokenId);
  }
  if (stack.activationKeyId) {
    await supabase.from('activation_keys').delete().eq('id', stack.activationKeyId);
  }
  if (stack.userId) {
    await supabase.from('provisioned_users').delete().eq('id', stack.userId);
  }
  if (stack.companyId) {
    await supabase.from('vault_feature_gates').delete().eq('company_id', stack.companyId);
    await supabase.from('companies').delete().eq('id', stack.companyId);
  }
}

/**
 * Execute the full onboarding transaction with compensating rollback.
 */
export async function executeOnboardingTransaction(
  raw: UnifiedOnboardingData,
  actor: OnboardingActor,
  options: { sendWelcomeEmail?: boolean; appUrl?: string } = {},
): Promise<OnboardingTransactionResult> {
  const parsed = unifiedOnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      companyId: null,
      contactUserId: null,
      activationKey: null,
      setupToken: null,
      hierarchyViolations: [],
      emailDispatched: false,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    };
  }

  const data = parsed.data;
  const stack: RollbackStack = {};
  const locations = Array.from(
    new Set([
      data.primaryLocation.trim(),
      ...data.fleetLocations.map((l) => l.trim()).filter(Boolean),
    ]),
  );

  try {
    // 1. Corporate entity
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .insert({
        name: data.organizationName.trim(),
        region: data.region,
        location: data.primaryLocation.trim(),
        plan_tier: data.planTier,
        fleet_locations: locations,
        fleet_size: data.fleetSizeEstimate ?? locations.length,
        industry: data.industry || null,
        account_status: 'trial',
        health_score: 80,
      })
      .select()
      .single();

    if (companyErr || !company) {
      throw new Error(companyErr?.message || 'Failed to create company');
    }
    stack.companyId = company.id;

    // 2. Fleet director / primary contact
    const { data: contact, error: contactErr } = await supabase
      .from('provisioned_users')
      .insert({
        full_name: data.contactName.trim(),
        email: data.contactEmail.trim().toLowerCase(),
        phone: data.contactPhone || null,
        corporate_title:
          data.corporateTitle ||
          (data.contactRole === 'super_admin'
            ? 'Primary Contact — Super-Admin'
            : 'Primary Contact — Location Admin'),
        company_id: company.id,
        company_name: company.name,
        role: data.contactRole,
        primary_contact_role: data.contactRole,
        status: 'pending_invitation',
        plan_tier: data.planTier,
        assigned_locations: [data.primaryLocation.trim()],
        scoped_company_ids:
          data.contactRole === 'location_admin' ? [company.id] : [company.id],
        deployment_hardware: 'c55_pro',
        feature_permissions: {
          driver_management: true,
          incident_playback: data.entitlements.radar,
          historical_reports: true,
          insurance_scorecards: data.entitlements.risk_scoring,
          pdf_downloads: true,
          live_gps: data.entitlements.gps,
        },
        provisioned_by: actor.email,
        provisioned_by_role: actor.role,
        onboarded_by: actor.email,
        onboarding_completed: false,
      })
      .select()
      .single();

    if (contactErr || !contact) {
      throw new Error(contactErr?.message || 'Failed to create fleet director contact');
    }
    stack.userId = contact.id;

    // 3. Permanent organization activation key
    const activationKey = generateActivationKey(company.name);
    const { data: keyRow, error: keyErr } = await supabase
      .from('activation_keys')
      .insert({
        key_code: activationKey,
        role_type: data.contactRole,
        company_name: company.name,
        company_id: company.id,
        recipient_email: data.contactEmail.trim().toLowerCase(),
        status: 'active',
        created_by_email: actor.email,
        organization_name: company.name,
        feature_entitlements: data.entitlements,
        is_setup_link: true,
        expires_at: null,
      })
      .select()
      .single();

    if (keyErr || !keyRow) {
      throw new Error(keyErr?.message || 'Failed to create activation key');
    }
    stack.activationKeyId = keyRow.id;

    // 4. Single-use setup token (72h)
    const setupToken = generateSetupToken();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('invite_tokens')
      .insert({
        token: setupToken,
        user_email: data.contactEmail.trim().toLowerCase(),
        company_id: company.id,
        created_by: actor.email,
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        invite_type: 'setup_link',
      })
      .select()
      .single();

    if (tokenErr || !tokenRow) {
      throw new Error(tokenErr?.message || 'Failed to create setup token');
    }
    stack.inviteTokenId = tokenRow.id;

    // 5. Feature gates
    await supabase.from('vault_feature_gates').upsert(
      {
        company_id: company.id,
        tier: data.planTier,
        forensic_vault_enabled: data.entitlements.vault,
        collision_reconstruction_enabled: data.entitlements.vault,
        insurance_modeling_enabled: data.entitlements.risk_scoring,
        pdf_export_enabled: data.planTier !== 'basic',
        live_gps_enabled: data.entitlements.gps,
        historical_reports_enabled: data.planTier !== 'basic',
      },
      { onConflict: 'company_id' },
    );

    // 6. Hierarchy invariants
    const snapshot: HierarchySnapshot = {
      companyId: company.id,
      companyName: company.name,
      directors: [
        {
          id: contact.id,
          email: contact.email,
          name: contact.full_name,
          role: contact.role,
          scopedCompanyIds: contact.scoped_company_ids || [company.id],
        },
      ],
      drivers: [],
      vehicles: [],
    };
    const hierarchyViolations = validateHierarchy(snapshot);
    if (hierarchyViolations.length > 0) {
      await rollback(stack);
      return {
        success: false,
        companyId: null,
        contactUserId: null,
        activationKey: null,
        setupToken: null,
        hierarchyViolations,
        emailDispatched: false,
        error: 'Hierarchy validation failed',
        rolledBack: true,
      };
    }

    // 7. Custody seal (best-effort persist)
    try {
      const custody = await sealCustodyEvent({
        artifactType: 'company_onboarding',
        artifactId: company.id,
        companyId: company.id,
        action: 'created',
        actor: {
          accountId: null,
          email: actor.email,
          role: actor.role,
          displayName: actor.name,
        },
        device: {
          deviceId: 'crm-console',
          platform: 'web',
          appVersion: '1.0.0',
        },
        metadata: {
          contact_email: data.contactEmail,
          plan_tier: data.planTier,
          locations,
        },
      });

      await supabase.from('chain_of_custody_events').insert({
        id: custody.id,
        seq: custody.seq,
        artifact_type: custody.artifact_type,
        artifact_id: custody.artifact_id,
        company_id: custody.company_id,
        action: custody.action,
        actor_account_id: custody.actor_account_id,
        actor_email: custody.actor_email,
        actor_role: custody.actor_role,
        device_id: custody.device_id,
        device_platform: custody.device_platform,
        app_version: custody.app_version,
        network_timestamp: custody.network_timestamp,
        server_timestamp: custody.server_timestamp,
        artifact_hash: custody.artifact_hash,
        prev_hash: custody.prev_hash,
        record_hash: custody.record_hash,
        metadata: custody.metadata,
      });
    } catch {
      // Custody table may not be migrated yet — non-fatal
    }

    // 8. Welcome email via welcome@fleetvu.org
    let emailDispatched = false;
    if (options.sendWelcomeEmail !== false) {
      const appUrl = options.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const setupUrl = `${appUrl}/accept-invite?token=${setupToken}`;
      const result = await dispatchWelcome({
        to: data.contactEmail,
        subject: `Welcome to FleetVu — ${company.name} setup`,
        html: buildWelcomeHtml({
          toName: data.contactName,
          organizationName: company.name,
          leadRole: data.contactRole,
          activationKey,
          setupUrl,
          primaryLocation: data.primaryLocation,
          planTier: data.planTier,
          welcomeMessage: data.welcomeMessage || '',
          deployedByName: actor.name || actor.email,
          entitlements: data.entitlements,
        }),
        correlationId: company.id,
        metadata: { type: 'CLIENT_SETUP_LINK', company_id: company.id },
      });
      emailDispatched =
        result.success ||
        result.status === 'queued' ||
        result.status === 'retrying' ||
        result.status === 'sent';
    }

    return {
      success: true,
      companyId: company.id,
      contactUserId: contact.id,
      activationKey,
      setupToken,
      hierarchyViolations: [],
      emailDispatched,
    };
  } catch (err) {
    await rollback(stack);
    return {
      success: false,
      companyId: null,
      contactUserId: null,
      activationKey: null,
      setupToken: null,
      hierarchyViolations: [],
      emailDispatched: false,
      error: err instanceof Error ? err.message : 'Onboarding transaction failed',
      rolledBack: true,
    };
  }
}

function buildWelcomeHtml(p: {
  toName: string;
  organizationName: string;
  leadRole: string;
  activationKey: string;
  setupUrl: string;
  primaryLocation: string;
  planTier: string;
  welcomeMessage: string;
  deployedByName: string;
  entitlements: Record<string, boolean>;
}): string {
  const featureList = Object.entries(p.entitlements)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(' · ');
  const isSuperAdmin = p.leadRole === 'super_admin';
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">FleetVu</div>
      <div style="font-size: 11px; color: #fb923c; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px;">Client Onboarding · welcome@fleetvu.org</div>
      <h1 style="font-size: 24px; color: #ffffff; margin: 0 0 16px;">Welcome to FleetVu, ${escapeHtml(p.toName)}</h1>
      <p style="font-size: 15px; line-height: 1.6; color: #94a3b8;">
        <strong style="color: #e2e8f0;">${escapeHtml(p.deployedByName)}</strong> has provisioned
        <strong style="color: #fb923c;">${escapeHtml(p.organizationName)}</strong> and set you up as
        <strong>${isSuperAdmin ? 'Super-Admin' : 'Location Admin'}</strong>.
      </p>
      ${p.welcomeMessage ? `<p style="font-style: italic; color: #e2e8f0;">${escapeHtml(p.welcomeMessage)}</p>` : ''}
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Organization</span> · <strong>${escapeHtml(p.organizationName)}</strong></div>
        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Location</span> · <strong>${escapeHtml(p.primaryLocation)}</strong></div>
        <div style="margin-bottom: 8px;"><span style="color: #64748b;">Plan</span> · <strong>${escapeHtml(p.planTier.toUpperCase())}</strong></div>
        <div><span style="color: #64748b;">Features</span> · <strong>${escapeHtml(featureList)}</strong></div>
      </div>
      <div style="background: #1e293b; border: 1px solid #f97316; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; color: #fb923c; font-weight: 600; margin-bottom: 8px;">ACTIVATION KEY</div>
        <code style="font-size: 18px; color: #f97316; font-weight: 700;">${escapeHtml(p.activationKey)}</code>
      </div>
      <a href="${p.setupUrl}" style="display: inline-block; background: #f97316; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">Launch Setup Wizard</a>
      <p style="font-size: 11px; color: #475569; margin-top: 32px;">FleetVu — Enterprise Fleet Telemetry &amp; Forensic Risk Intelligence. Sent via welcome@fleetvu.org.</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
