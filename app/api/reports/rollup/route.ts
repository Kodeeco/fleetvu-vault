import { NextRequest, NextResponse } from 'next/server';
import {
  getRollupPrefs,
  saveRollupPrefs,
  runCompanySafetyRollup,
  isRollupDue,
  type RollupCadence,
} from '@/lib/safety-report-rollup';
import { supabase } from '@/lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-FleetVu-Cron-Key',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

/**
 * GET ?companyId=… — load Admin rollup preference
 * POST { action: 'save' | 'run' | 'cron', … }
 */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400, headers: corsHeaders });
  }
  const prefs = await getRollupPrefs(companyId);
  return NextResponse.json(
    {
      prefs: prefs || {
        companyId,
        enabled: false,
        cadence: 'weekly',
        weeklyWeekday: 5,
        lastSentAt: null,
      },
    },
    { headers: corsHeaders },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'save') {
      const companyId = body.companyId as string;
      if (!companyId) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400, headers: corsHeaders });
      }
      const cadence = (body.cadence || 'weekly') as RollupCadence;
      if (!['daily', 'weekly', 'monthly'].includes(cadence)) {
        return NextResponse.json({ error: 'Invalid cadence' }, { status: 400, headers: corsHeaders });
      }
      const result = await saveRollupPrefs({
        companyId,
        enabled: !!body.enabled,
        cadence,
        weeklyWeekday: typeof body.weeklyWeekday === 'number' ? body.weeklyWeekday : 5,
        updatedBy: body.updatedBy || null,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500, headers: corsHeaders });
      }
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (action === 'run') {
      const companyId = body.companyId as string;
      if (!companyId) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400, headers: corsHeaders });
      }
      const result = await runCompanySafetyRollup({
        companyId,
        companyName: body.companyName || null,
        cadence: body.cadence,
        force: true,
        triggeredBy: body.triggeredBy || 'admin:run-now',
      });
      return NextResponse.json(result, {
        status: result.success ? 200 : 500,
        headers: corsHeaders,
      });
    }

    if (action === 'cron') {
      const cronKey = req.headers.get('x-fleetvu-cron-key') || body.cronKey;
      const expected = process.env.FLEETVU_ROLLUP_CRON_KEY || process.env.CRON_SECRET;
      if (expected && cronKey !== expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
      }

      const { data: prefsList } = await supabase
        .from('safety_report_rollup_prefs')
        .select('*')
        .eq('enabled', true);

      const results: Array<{ companyId: string; ok: boolean; error?: string }> = [];
      for (const row of prefsList || []) {
        const prefs = {
          companyId: row.company_id,
          enabled: !!row.enabled,
          cadence: row.cadence as RollupCadence,
          weeklyWeekday: row.weekly_weekday ?? 5,
          lastSentAt: row.last_sent_at || null,
        };
        if (!isRollupDue(prefs)) {
          results.push({ companyId: row.company_id, ok: true, error: 'not_due' });
          continue;
        }
        const run = await runCompanySafetyRollup({
          companyId: row.company_id,
          cadence: prefs.cadence,
          force: false,
          triggeredBy: 'system:cron',
        });
        results.push({
          companyId: row.company_id,
          ok: run.success,
          error: run.error,
        });
      }

      return NextResponse.json({ success: true, results }, { headers: corsHeaders });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Rollup failed' },
      { status: 500, headers: corsHeaders },
    );
  }
}
