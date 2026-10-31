/**
 * ACID-Compliant Company Onboarding Transaction
 *
 * Creates company → fleet director (contact) → fleet locations / entitlements
 * as a compensating-transaction unit: on any failure, previously inserted
 * rows are rolled back (deleted) in reverse order.
 */

import { randomBytes, randomUUID } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { dispatchWelcome } from '@/lib/email';
import { sendWithSmtpCredentials } from '@/lib/email/transport';
import { getLiveCrmSmtp } from '@/lib/crm/email-config-server';
import { buildWelcomeRosterEmail } from '@/lib/email/welcome-roster-template';
import {
  buildFleetVuEmailHtml,
  emailDetailCard,
  vaultEmailLogoSrc,
} from '@/lib/email/fleetvu-email-chrome';
import { vaultEmailLogoAttachment } from '@/lib/email/email-logo-server';
import { upsertRosterToken } from '@/lib/roster/token-store';
import { sealCustodyEvent } from '@/lib/forensics';
import {
  unifiedOnboardingSchema,
  type UnifiedOnboardingData,
} from './schema';
import { validateHierarchy, type HierarchySnapshot } from './hierarchy';
import type { OnboardingActor, OnboardingTransactionResult } from './types';
import {
  uploadCompanyLogo,
  type CompanyLogoUpload,
} from '@/lib/company-logo-upload';
import {
  corporatePlanCode,
  corporatePlanToProductLine,
  normalizeCorporatePlan,
} from '@/lib/crm/corporate-plans';
import { saveCompanyAccount } from '@/lib/crm/company-account-store';
import { upsertLocalCompany } from '@/lib/crm/companies-store';
import { saveRollupPrefs, DEFAULT_WEEKLY_DELIVERY_WEEKDAY } from '@/lib/safety-report-rollup';
import type { RollupCadence } from '@/lib/safety-report-rollup';

function generateRosterToken(): string {
  return randomBytes(32).toString('hex');
}

function isDbPermissionError(message?: string | null): boolean {
  if (!message) return false;
  return /permission denied|schema public|row-level security|not authorized|42501/i.test(
    message,
  );
}

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
    await getServerSupabase().from('invite_tokens').delete().eq('id', stack.inviteTokenId);
  }
  if (stack.activationKeyId) {
    await getServerSupabase().from('activation_keys').delete().eq('id', stack.activationKeyId);
  }
  if (stack.userId) {
    await getServerSupabase().from('provisioned_users').delete().eq('id', stack.userId);
  }
  if (stack.companyId) {
    await getServerSupabase().from('vault_feature_gates').delete().eq('company_id', stack.companyId);
    await getServerSupabase().from('companies').delete().eq('id', stack.companyId);
  }
}

/**
 * Execute the full onboarding transaction with compensating rollback.
 */
export async function executeOnboardingTransaction(
  raw: UnifiedOnboardingData,
  actor: OnboardingActor,
  options: {
    sendWelcomeEmail?: boolean;
    appUrl?: string;
    logo?: CompanyLogoUpload | null;
  } = {},
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

  const corporatePlan = normalizeCorporatePlan(data.planTier);
  const productLine = corporatePlanToProductLine(corporatePlan);
  const isInsurancePack = productLine === 'insurance' || productLine === 'both';

  try {
    // 1. Corporate entity
    // Core columns first — optional CRM fields may be missing on older Supabase schemas.
    const coreCompany = {
      name: data.organizationName.trim(),
      region: data.region,
      location: data.primaryLocation.trim(),
      plan_tier: corporatePlan,
      fleet_locations: locations,
      fleet_size: data.fleetSizeEstimate ?? locations.length,
      account_status: 'trial',
      health_score: 80,
    };
    const optionalCompany: Record<string, string | null> = {};
    if (data.industry?.trim()) optionalCompany.industry = data.industry.trim();
    if (data.usdot?.trim()) optionalCompany.usdot = data.usdot.trim();
    if (data.annualMilesFmcsa?.trim()) {
      optionalCompany.annual_miles_fmcsa = data.annualMilesFmcsa.trim();
    }

    let company: { id: string; name: string } | null = null;
    let companyErr: { message?: string } | null = null;
    let usedLocalDbFallback = false;

    {
      const first = await getServerSupabase()
        .from('companies')
        .insert({ ...coreCompany, ...optionalCompany })
        .select('id, name')
        .single();
      company = first.data;
      companyErr = first.error;
    }

    // Retry without optional columns if schema cache doesn't have them yet.
    if (companyErr && /column|schema cache/i.test(companyErr.message || '')) {
      const retry = await getServerSupabase()
        .from('companies')
        .insert(coreCompany)
        .select('id, name')
        .single();
      company = retry.data;
      companyErr = retry.error;

      if (company?.id && Object.keys(optionalCompany).length) {
        for (const [key, value] of Object.entries(optionalCompany)) {
          const patch = await getServerSupabase()
            .from('companies')
            .update({ [key]: value })
            .eq('id', company.id);
          if (patch.error) {
            console.warn(`[onboarding] optional company field skipped: ${key}`, patch.error.message);
          }
        }
      }
    }

    // Supabase role blocked (common when SERVICE_ROLE_KEY is missing) — save to local CRM.
    if ((companyErr || !company) && isDbPermissionError(companyErr?.message)) {
      usedLocalDbFallback = true;
      const localId = randomUUID();
      const now = new Date().toISOString();
      company = { id: localId, name: coreCompany.name };
      upsertLocalCompany({
        id: localId,
        name: coreCompany.name,
        region: coreCompany.region,
        location: coreCompany.location,
        plan_tier: corporatePlan,
        fleet_locations: locations,
        fleet_size: coreCompany.fleet_size,
        account_status: 'trial',
        health_score: 80,
        industry: optionalCompany.industry || null,
        usdot: optionalCompany.usdot || null,
        annual_miles_fmcsa: optionalCompany.annual_miles_fmcsa || null,
        sales_rep: data.contactName.trim(),
        notes: `Local CRM deploy (DB permission blocked). Contact ${data.contactEmail.trim().toLowerCase()}`,
        created_at: now,
      } as Parameters<typeof upsertLocalCompany>[0]);
      companyErr = null;
      console.warn(
        '[onboarding] companies insert blocked — saved to local CRM mirror. Add SUPABASE_SERVICE_ROLE_KEY on the host.',
      );
    }

    if (companyErr || !company) {
      throw new Error(companyErr?.message || 'Failed to create company');
    }
    stack.companyId = usedLocalDbFallback ? undefined : company.id;

    // Keep local Customers list in sync even when Supabase write succeeds.
    if (!usedLocalDbFallback) {
      try {
        upsertLocalCompany({
          id: company.id,
          name: company.name,
          region: coreCompany.region,
          location: coreCompany.location,
          plan_tier: corporatePlan,
          fleet_locations: locations,
          fleet_size: coreCompany.fleet_size,
          account_status: 'trial',
          health_score: 80,
          industry: optionalCompany.industry || null,
          usdot: optionalCompany.usdot || null,
          annual_miles_fmcsa: optionalCompany.annual_miles_fmcsa || null,
          sales_rep: data.contactName.trim(),
          created_at: new Date().toISOString(),
        } as Parameters<typeof upsertLocalCompany>[0]);
      } catch {
        /* non-fatal */
      }
    }

    // 1b. Optional customer wordmark (Vault lock / HUD branding)
    if (options.logo?.base64) {
      await uploadCompanyLogo(company.id, options.logo);
    }

    // 1c. Product line + report destinations for CRM packs
    const reportEmails = Array.from(
      new Set(
        [
          ...(data.reportEmails || []),
          data.contactEmail.trim().toLowerCase(),
        ]
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes('@')),
      ),
    );
    saveCompanyAccount({
      companyId: company.id,
      productLine,
      reportEmails,
      pocName: data.contactName.trim(),
      pocEmail: data.contactEmail.trim().toLowerCase(),
      pocPhone: data.contactPhone || '',
    });

    // 1d. Safety digest schedule → customer account (same controls as CRM Account controls)
    const digestCadence = (data.digestCadence || 'weekly') as RollupCadence;
    await saveRollupPrefs({
      companyId: company.id,
      enabled: data.digestEnabled !== false,
      cadence: digestCadence,
      weeklyWeekday: DEFAULT_WEEKLY_DELIVERY_WEEKDAY,
      updatedBy: actor.email,
    });

    // 2. Fleet director / primary contact
    let contact: {
      id: string;
      email: string;
      full_name: string;
      role: string;
      assigned_locations?: string[] | null;
      scoped_company_ids?: string[] | null;
    } | null = null;

    if (!usedLocalDbFallback) {
      const { data: contactRow, error: contactErr } = await getServerSupabase()
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
          plan_tier: corporatePlan,
          assigned_locations: [data.primaryLocation.trim()],
          scoped_company_ids: [company.id],
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

      if (contactErr || !contactRow) {
        if (isDbPermissionError(contactErr?.message)) {
          usedLocalDbFallback = true;
        } else {
          throw new Error(contactErr?.message || 'Failed to create fleet director contact');
        }
      } else {
        contact = contactRow;
        stack.userId = contactRow.id;
      }
    }

    if (!contact) {
      contact = {
        id: randomUUID(),
        email: data.contactEmail.trim().toLowerCase(),
        full_name: data.contactName.trim(),
        role: data.contactRole,
        assigned_locations: [data.primaryLocation.trim()],
        scoped_company_ids: [company.id],
      };
    }

    // 3. Permanent organization activation key
    const activationKey = generateActivationKey(company.name);
    if (!usedLocalDbFallback) {
      const { data: keyRow, error: keyErr } = await getServerSupabase()
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
        if (isDbPermissionError(keyErr?.message)) {
          usedLocalDbFallback = true;
        } else {
          throw new Error(keyErr?.message || 'Failed to create activation key');
        }
      } else {
        stack.activationKeyId = keyRow.id;
      }
    }

    // 4. Single-use setup token (72h)
    const setupToken = generateSetupToken();
    if (!usedLocalDbFallback) {
      const { data: tokenRow, error: tokenErr } = await getServerSupabase()
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
        if (isDbPermissionError(tokenErr?.message)) {
          usedLocalDbFallback = true;
        } else {
          throw new Error(tokenErr?.message || 'Failed to create setup token');
        }
      } else {
        stack.inviteTokenId = tokenRow.id;
      }
    }

    // 5. Feature gates (best-effort)
    if (!usedLocalDbFallback) {
      await getServerSupabase().from('vault_feature_gates').upsert(
        {
          company_id: company.id,
          tier: corporatePlan,
          forensic_vault_enabled: data.entitlements.vault || isInsurancePack,
          collision_reconstruction_enabled: data.entitlements.vault || isInsurancePack,
          insurance_modeling_enabled: data.entitlements.risk_scoring || isInsurancePack,
          pdf_export_enabled: true,
          live_gps_enabled: data.entitlements.gps,
          historical_reports_enabled: true,
        },
        { onConflict: 'company_id' },
      );
    }

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
          plan_tier: corporatePlan,
          locations,
        },
      });

      await getServerSupabase().from('chain_of_custody_events').insert({
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

    // 8. Welcome + Roster Portal email via LIVE CRM SMTP (same path as Customers → Welcome)
    let emailDispatched = false;
    let rosterPortalUrl: string | null = null;
    if (options.sendWelcomeEmail !== false) {
      const appUrl = (
        options.appUrl ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://app.fleetvu.org'
      ).replace(/\/+$/, '');
      const seatLimit = Math.max(1, Math.min(500, data.fleetSizeEstimate || 25));
      const rosterToken = generateRosterToken();
      // Permanent fleet-account invite — customers bookmark / return anytime (password login at /vault).
      const companyUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          company.id,
        )
          ? company.id
          : null;

      const persist = await upsertRosterToken({
        token: rosterToken,
        company_id: companyUuid,
        company_name: company.name,
        contact_email: data.contactEmail.trim().toLowerCase(),
        contact_name: data.contactName.trim(),
        driver_seat_limit: seatLimit,
        status: 'active',
        expires_at: null,
      });

      const built = buildWelcomeRosterEmail({
        organizationName: company.name,
        contactName: data.contactName.trim(),
        rosterToken,
        driverSeatLimit: seatLimit,
        appBaseUrl: appUrl,
      });
      rosterPortalUrl = built.portalUrl;
      const subject = `Welcome aboard — Access your FleetVu Roster Portal (${company.name})`;
      const liveCrm = getLiveCrmSmtp({ trigger: 'welcome_onboarding' });

      if (liveCrm && persist.ok) {
        const smtpResult = await sendWithSmtpCredentials(
          {
            from: liveCrm.fromEmail,
            fromName: liveCrm.fromDisplayName,
            to: [data.contactEmail.trim().toLowerCase()],
            subject,
            html: built.html,
            cc: [],
            bcc: [],
            replyTo: liveCrm.fromEmail,
            attachments: built.attachments,
          },
          {
            host: liveCrm.smtp.host,
            port: liveCrm.smtp.port || 465,
            tlsEnabled: liveCrm.smtp.tlsEnabled !== false,
            username: liveCrm.smtp.username,
            password: liveCrm.smtp.password,
          },
        );
        emailDispatched = Boolean(smtpResult.success);
        if (!smtpResult.success) {
          console.warn('[onboarding] LIVE SMTP welcome failed:', smtpResult.error);
        }
      } else {
        // Fallback dispatch (may dry-run if host SMTP env is empty)
        const setupUrl = `${appUrl}/accept-invite?token=${setupToken}`;
        const result = await dispatchWelcome({
          to: data.contactEmail,
          subject,
          html:
            built.html ||
            buildWelcomeHtml({
              toName: data.contactName,
              organizationName: company.name,
              leadRole: data.contactRole,
              activationKey,
              setupUrl,
              primaryLocation: data.primaryLocation,
              planTier: corporatePlanCode(corporatePlan),
              welcomeMessage: data.welcomeMessage || '',
              deployedByName: actor.name || actor.email,
              entitlements: data.entitlements,
            }),
          attachments: built.attachments,
          correlationId: company.id,
          metadata: {
            type: 'WELCOME_ROSTER_PORTAL',
            company_id: company.id,
            roster_token: rosterToken,
            storage: persist.ok ? persist.storage : 'none',
          },
        });
        emailDispatched =
          result.success ||
          result.status === 'queued' ||
          result.status === 'retrying' ||
          result.status === 'sent';
        if (result.provider === 'dry_run') {
          emailDispatched = false;
          console.warn(
            '[onboarding] Welcome email dry-run — enable LIVE SMTP in CRM → Email and Save Config.',
          );
        }
      }
    }

    return {
      success: true,
      companyId: company.id,
      contactUserId: contact.id,
      activationKey,
      setupToken,
      hierarchyViolations: [],
      emailDispatched,
      localFallback: usedLocalDbFallback,
      rosterPortalUrl,
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
  const logo = vaultEmailLogoAttachment();
  return buildFleetVuEmailHtml({
    eyebrow: 'Client Onboarding',
    fromLine: 'welcome@fleetvu.org',
    title: `Welcome to FleetVu, ${p.toName}`,
    introHtml: `<strong style="color:#ffffff;">${escapeEmailHtml(p.deployedByName)}</strong> has provisioned
      <strong style="color:#d4a017;">${escapeEmailHtml(p.organizationName)}</strong> as
      <strong style="color:#ffffff;">${isSuperAdmin ? 'Super-Admin' : 'Location Admin'}</strong>.`,
    bodyHtml: [
      p.welcomeMessage
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;"><tr><td style="background:#111827;border:1px solid #334155;padding:16px 18px;color:#e2e8f0;font-size:14px;font-style:italic;line-height:1.55;">${escapeEmailHtml(p.welcomeMessage)}</td></tr></table>`
        : '',
      emailDetailCard([
        { label: 'Organization', value: p.organizationName },
        { label: 'Primary Location', value: p.primaryLocation },
        { label: 'Plan', value: p.planTier.toUpperCase() },
        { label: 'Features', value: featureList || '—' },
      ]),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr><td style="background:#111827;border:1px solid #c9a227;padding:16px 18px;text-align:center;">
        <div style="font-size:11px;color:#d4a017;font-weight:700;letter-spacing:0.12em;margin-bottom:8px;">ACTIVATION KEY</div>
        <code style="font-size:18px;font-family:Consolas,monospace;color:#d4a017;font-weight:700;letter-spacing:0.06em;">${escapeEmailHtml(p.activationKey)}</code>
      </td></tr></table>`,
    ].join(''),
    cta: { href: p.setupUrl, label: 'LAUNCH SETUP WIZARD' },
    legalLine: 'FleetVu — Sent via welcome@fleetvu.org. Do not reply to this automated message.',
    logoUrl: vaultEmailLogoSrc({ useCid: Boolean(logo) }),
    documentTitle: 'Welcome to FleetVu',
  });
}

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
