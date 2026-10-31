import { NextRequest, NextResponse } from 'next/server';
import {
  classifyIncidentShare,
  getIncidentShareByToken,
  recordShareAccess,
} from '@/lib/fleet-account/share-store';
import { listLocalCompanies } from '@/lib/crm/companies-store';
import { appendFleetAudit } from '@/lib/fleet-account/audit-store';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

/**
 * Public secure-share lookup (token in query). Returns safe metadata only.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') || req.nextUrl.searchParams.get('token') || '';
  if (!token.trim()) {
    return NextResponse.json(
      { status: 'missing', error: 'Missing share token' },
      { status: 400, headers: corsHeaders },
    );
  }

  const existing = getIncidentShareByToken(token.trim());
  const preliminary = classifyIncidentShare(existing);
  if (preliminary === 'missing' || !existing) {
    return NextResponse.json({ status: 'missing' }, { status: 404, headers: corsHeaders });
  }

  const { share, status } = await recordShareAccess(token.trim());
  const row = share || existing;
  const companies = listLocalCompanies();
  const company =
    companies.find((c) => c.id === row.companyId) ||
    companies.find((c) => c.name === row.companyId);
  const companyName = company?.name || 'Fleet customer';

  if (status === 'active') {
    const fwd = req.headers.get('x-forwarded-for');
    const ip = (fwd?.split(',')[0] || req.headers.get('x-real-ip') || '').trim() || null;
    try {
      await appendFleetAudit({
        companyId: row.companyId,
        action: 'incident_view',
        actorEmail: null,
        ip,
        userAgent: req.headers.get('user-agent'),
        detail: `External share opened for incident ${row.incidentId}`,
        meta: { shareId: row.id, accessCount: row.accessCount },
      });
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json(
    {
      status,
      companyName,
      incidentId: row.incidentId,
      incidentLabel: row.incidentLabel || row.incidentId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      accessCount: row.accessCount,
      revoked: !!row.revokedAt,
    },
    { headers: corsHeaders },
  );
}
