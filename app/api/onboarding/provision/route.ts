import { NextRequest, NextResponse } from 'next/server';
import { executeOnboardingTransaction } from '@/lib/onboarding/transaction';
import {
  unifiedOnboardingSchema,
  type UnifiedOnboardingData,
} from '@/lib/onboarding/schema';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  let body: {
    data?: UnifiedOnboardingData;
    actor?: { email: string; role: string; name?: string };
    sendWelcomeEmail?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }

  if (!body.data || !body.actor?.email) {
    return NextResponse.json(
      { error: 'data and actor.email are required' },
      { status: 400, headers: corsHeaders },
    );
  }

  const parsed = unifiedOnboardingSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422, headers: corsHeaders },
    );
  }

  const result = await executeOnboardingTransaction(parsed.data, body.actor, {
    sendWelcomeEmail: body.sendWelcomeEmail !== false,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 422, headers: corsHeaders });
  }

  return NextResponse.json(result, { status: 200, headers: corsHeaders });
}
