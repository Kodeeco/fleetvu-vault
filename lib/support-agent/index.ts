/**
 * Customer Support Agent — response engine
 * Rule-based by default; optional OpenAI when OPENAI_API_KEY is set.
 */

import {
  CUSTOMER_SUPPORT_TOPICS,
  SUPPORT_AGENT_SYSTEM_PREAMBLE,
  type SupportTopic,
} from './knowledge';

export interface SupportChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SupportAgentReply {
  reply: string;
  matchedTopicId: string | null;
  deepLink: string | null;
  suggestEscalate: boolean;
  confidence: 'high' | 'medium' | 'low';
  source: 'knowledge' | 'llm' | 'fallback';
}

function scoreTopic(query: string, topic: SupportTopic): number {
  const q = query.toLowerCase();
  let score = 0;
  for (const kw of topic.keywords) {
    if (q.includes(kw.toLowerCase())) score += kw.length > 6 ? 3 : 2;
  }
  if (q.includes(topic.title.toLowerCase().slice(0, 12))) score += 2;
  return score;
}

export function matchSupportTopic(query: string): { topic: SupportTopic | null; score: number } {
  let best: SupportTopic | null = null;
  let bestScore = 0;
  for (const topic of CUSTOMER_SUPPORT_TOPICS) {
    const s = scoreTopic(query, topic);
    if (s > bestScore) {
      bestScore = s;
      best = topic;
    }
  }
  if (bestScore < 2) return { topic: null, score: 0 };
  return { topic: best, score: bestScore };
}

export function buildKnowledgeReply(query: string): SupportAgentReply {
  const { topic, score } = matchSupportTopic(query);
  if (!topic) {
    return {
      reply:
        'I can help with portal navigation, inviting users, Driver Vault, GPS, billing, reports, and access requests. What are you trying to do? If you need a human for a product issue, say “talk to support” — don’t include accident evidence in tickets.',
      matchedTopicId: null,
      deepLink: null,
      suggestEscalate: /support|human|stuck|broken|bug/i.test(query),
      confidence: 'low',
      source: 'fallback',
    };
  }

  return {
    reply: topic.answer,
    matchedTopicId: topic.id,
    deepLink: topic.deepLink ?? null,
    suggestEscalate: topic.id === 'escalate',
    confidence: score >= 5 ? 'high' : 'medium',
    source: 'knowledge',
  };
}

export async function generateSupportReply(
  messages: SupportChatMessage[],
): Promise<SupportAgentReply> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const query = lastUser?.content?.trim() || '';
  const knowledge = buildKnowledgeReply(query);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !query) return knowledge;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUPPORT_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 450,
        messages: [
          { role: 'system', content: SUPPORT_AGENT_SYSTEM_PREAMBLE },
          {
            role: 'system',
            content: `Known topics:\n${CUSTOMER_SUPPORT_TOPICS.map((t) => `- ${t.title}: ${t.answer}`).join('\n')}`,
          },
          ...messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) return knowledge;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return knowledge;

    return {
      reply: text,
      matchedTopicId: knowledge.matchedTopicId,
      deepLink: knowledge.deepLink,
      suggestEscalate: knowledge.suggestEscalate || /support@fleetvu|ticket|human/i.test(text),
      confidence: 'high',
      source: 'llm',
    };
  } catch {
    return knowledge;
  }
}

/** Strip anything that looks like evidence before escalating to FleetVu support */
export function sanitizeEscalationNote(raw: string): string {
  return raw
    .replace(/\b(case[_\s-]?id|incident[_\s-]?id)\s*[:=]?\s*\S+/gi, '[redacted-case-ref]')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[redacted-ip]')
    .replace(/data:image\/[a-z]+;base64,[a-z0-9+/=]+/gi, '[redacted-image]')
    .slice(0, 1200);
}
