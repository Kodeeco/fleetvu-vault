/**
 * FleetVu Customer Support Agent — Knowledge Base
 *
 * Customer-tenant help only. Never trains on or escalates accident evidence,
 * safety report payloads, or forensic vault contents to FleetVu staff.
 */

export interface SupportTopic {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  deepLink?: string; // hash view key when applicable
  actions?: Array<{ label: string; hint: string }>;
}

export const CUSTOMER_SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: 'find-reconstruction',
    title: 'Open Accident Reconstruction',
    keywords: ['reconstruction', 'incident', 'accident', 'crash', 'case', 'where is incident'],
    answer:
      'Incident Reconstruction lives in your company portal only (Super Admin / Admin). Open the Forensic Vault menu → Forensic Analysis → Accident Reconstruction, or use Account menu → Incident Reconstruction. FleetVu Global Admin cannot see your cases.',
    deepLink: 'accident-reconstruction',
    actions: [{ label: 'Open Reconstruction', hint: 'Navigate to your reconstruction queue' }],
  },
  {
    id: 'invite-users',
    title: 'Invite team members',
    keywords: ['invite', 'add user', 'team', 'provision', 'employee', 'driver account'],
    answer:
      'Go to Account menu → User & Team Management. Create invites for Admins, Managers, Executives, or Drivers. Invitees receive a welcome email with an activation link. Drivers can also be set up with Vault access keys for the mobile app.',
    actions: [{ label: 'User & Team Management', hint: 'Open users panel' }],
  },
  {
    id: 'vault-mobile',
    title: 'Driver Vault mobile app',
    keywords: ['vault', 'mobile', 'driver app', 'biometric', 'pin', 'pwa', 'lock screen'],
    answer:
      'Drivers use FleetVu Vault on mobile: biometric / PIN lock → feature hub → live sensors → incident reporting. From the web portal, open Forensic Vault → Open Driver Vault App to preview the flow. Ensure each driver has an active access key from User Management.',
  },
  {
    id: 'gps-map',
    title: 'Fleet GPS map',
    keywords: ['gps', 'map', 'tracking', 'location', 'where is truck', 'vehicle'],
    answer:
      'The dashboard center panel shows Fleet GPS Tracking. Select a company / region / location filter in the header, then pick a vehicle from the list. Expand the map for a larger view. GPS requires the GPS entitlement on your plan.',
  },
  {
    id: 'billing-plan',
    title: 'Billing & plan features',
    keywords: ['billing', 'plan', 'upgrade', 'pro', 'subscription', 'pricing', 'trial', 'expire'],
    answer:
      'Open Billing from the main navigation (or Account Settings). Plan tier controls Forensic Vault, reconstruction, and scorecards. If your trial is ending, renew from the vault expiry banner so legal/forensic tools stay unlocked for your company.',
  },
  {
    id: 'safety-reports',
    title: 'Safety & insurance reports',
    keywords: ['safety report', 'scorecard', 'insurance', 'export', 'pdf', 'archived'],
    answer:
      'Use Export Reports in the top nav for Safety Log, Risk Scorecard, and Insurance Scorecard. Archived Reports stores prior exports. These stay inside your customer tenant — they are not visible to FleetVu Global Admin.',
    deepLink: 'report-archiving',
  },
  {
    id: 'access-requests',
    title: 'Third-party access requests',
    keywords: ['access request', 'third party', 'lawyer', 'insurance company', 'share'],
    answer:
      'Super Admins approve external access from Account → Access Requests (or Vault → Third-Party Access). Grant only what the party needs; permissions are audited. Never share raw Vault credentials outside your org.',
    deepLink: 'third-party-access',
  },
  {
    id: 'cant-find',
    title: 'I can’t find a feature',
    keywords: ['cant find', "can't find", 'where is', 'missing', 'hidden', 'how do i', 'help navigate'],
    answer:
      'Try: (1) Forensic Vault dropdown (amber lock icon) for legal/forensic tools, (2) Account / gear menu for users & settings, (3) Export Reports for scorecards, (4) Dashboard filters for company → region → location. Tell me the feature name and I’ll point you there.',
  },
  {
    id: 'sensor-hardware',
    title: 'Sensors & hardware',
    keywords: ['sensor', 'radar', 'c55', 'hardware', 'pairing', 'telemetry', '77ghz'],
    answer:
      'Hardware profiles and sensor channels are managed per vehicle. Select a truck on the dashboard to see the Forensic Vault stream and radar status. Contact your FleetVu account team only for hardware provisioning — not for incident evidence questions.',
  },
  {
    id: 'escalate',
    title: 'Talk to a human',
    keywords: ['human', 'agent', 'support ticket', 'call', 'email support', 'stuck', 'broken', 'bug'],
    answer:
      'I can open a support ticket to support@fleetvu.org with a short description of the product issue (navigation, login, billing, hardware). Do not paste accident case IDs, photos, or reconstruction data into the ticket — keep legal evidence inside your company portal.',
    actions: [{ label: 'Create support ticket', hint: 'Escalate product help only' }],
  },
];

export const SUPPORT_AGENT_SYSTEM_PREAMBLE = `
You are FleetVu Customer Support Agent for a customer company portal user.
Help with navigation, accounts, billing, Vault mobile setup, GPS, and how-to questions.
NEVER ask the user to paste accident photos, case evidence, reconstruction data, or safety report contents.
NEVER claim FleetVu Global Admin can view their incidents — they cannot (legal isolation / subpoena firewall).
If the issue needs a human, offer a product-support ticket to support@fleetvu.org without evidence attachments.
Be concise, direct, and actionable.
`.trim();
