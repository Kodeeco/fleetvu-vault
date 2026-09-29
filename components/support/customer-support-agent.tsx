'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AuthUser } from '@/lib/app-context';
import { isFleetVuPlatformOperator } from '@/lib/legal-data-isolation';
import { MessageCircle, X, Send, Bot, LifeBuoy, Loader2, ExternalLink } from 'lucide-react';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  deepLink?: string | null;
  suggestEscalate?: boolean;
}

interface CustomerSupportAgentProps {
  user: AuthUser;
  companyName?: string | null;
  onNavigateDeepLink?: (viewKey: string) => void;
}

const STARTER_PROMPTS = [
  'Where is Accident Reconstruction?',
  'How do I invite a driver?',
  'Open Driver Vault help',
  'I can’t find Export Reports',
  'Talk to support',
];

/**
 * Floating AI support agent for CUSTOMER portal users only.
 * Hidden for FleetVu Global Admin (they use the business / provisioning portal).
 */
export function CustomerSupportAgent({
  user,
  companyName,
  onNavigateDeepLink,
}: CustomerSupportAgentProps) {
  const isPlatform = isFleetVuPlatformOperator({
    role: user.role,
    email: user.email,
  });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi — I’m your FleetVu customer support agent. I help with navigation, users, Vault, GPS, billing, and reports inside your company portal. I won’t send accident evidence to FleetVu.',
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, open]);

  if (isPlatform) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;

    const userTurn: ChatTurn = {
      id: `u_${Date.now()}`,
      role: 'user',
      content,
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    setBusy(true);

    try {
      const history = [...turns, userTurn]
        .filter((t) => t.role === 'user' || t.role === 'assistant')
        .map((t) => ({ role: t.role, content: t.content }));

      const escalate = /talk to support|human|create support ticket|escalate/i.test(content);

      const res = await fetch('/api/support/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          escalate,
          escalationNote: escalate ? content : undefined,
          actor: {
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            companyName: companyName || user.companyName,
          },
        }),
      });

      const data = await res.json();
      setTurns((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply || data.error || 'Sorry — I couldn’t reach support right now.',
          deepLink: data.deepLink,
          suggestEscalate: data.suggestEscalate,
        },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: 'assistant',
          content: 'Connection issue. Try again, or email support@fleetvu.org for product help (no accident files).',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[80] flex items-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-900/40 hover:bg-orange-600 transition-colors"
          aria-label="Open customer support agent"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="hidden sm:inline">Need help?</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[80] flex h-[min(560px,78vh)] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800/90 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/40">
              <Bot className="h-4 w-4 text-orange-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">Customer Support Agent</div>
              <div className="text-[10px] text-slate-400 truncate">Your company portal · not FleetVu staff</div>
            </div>
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close support agent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {turns.map((t) => (
              <div
                key={t.id}
                className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    t.role === 'user'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  {t.content}
                  {t.deepLink && onNavigateDeepLink && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:text-orange-200"
                      onClick={() => onNavigateDeepLink(t.deepLink!)}
                    >
                      <ExternalLink className="h-3 w-3" /> Take me there
                    </button>
                  )}
                  {t.suggestEscalate && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200"
                      onClick={() => send('Create support ticket — I need a human for a product issue')}
                    >
                      <LifeBuoy className="h-3 w-3" /> Create support ticket
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-700 px-2 py-2">
            <div className="mb-2 flex flex-wrap gap-1">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => send(p)}
                  className="rounded-full border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300 hover:border-orange-500/50 hover:text-orange-200"
                >
                  {p}
                </button>
              ))}
            </div>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask how to find something…"
                className="h-9 bg-slate-800 border-slate-600 text-xs text-white"
                disabled={busy}
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy || !input.trim()}
                className="h-9 bg-orange-500 hover:bg-orange-600 px-3"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
            <p className="mt-1.5 text-[9px] text-slate-500 leading-snug px-0.5">
              Product help only. Do not paste accident files or case evidence here.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
