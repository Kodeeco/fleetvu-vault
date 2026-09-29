'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Save, CheckCircle2, Star, Lock, ShieldAlert } from 'lucide-react';
import type { PricingConfig, PlanTier } from '@/lib/types';

interface PricingModalProps {
  pricing: PricingConfig[];
  onUpdate: () => void;
  onClose: () => void;
  canEdit?: boolean;
  userRole?: string;
}

export function PricingModal({ pricing, onUpdate, onClose, canEdit = true, userRole = 'global_admin' }: PricingModalProps) {
  const [tiers, setTiers] = useState(
    pricing.length > 0
      ? pricing
      : [
          { id: '', tier: 'basic' as PlanTier, name: 'Basic Plan', price_monthly: 0, description: 'Standard plan', features: ['Unlimited fleet'], is_active: true, updated_at: '', created_at: '' },
          { id: '', tier: 'pro' as PlanTier, name: 'Pro Plan', price_monthly: 9.95, description: 'Pro plan', features: ['Live GPS'], is_active: true, updated_at: '', created_at: '' },
          { id: '', tier: 'proplus' as PlanTier, name: 'Pro+ Plan', price_monthly: 19.95, description: 'Pro+ plan', features: ['360 analytics'], is_active: true, updated_at: '', created_at: '' },
        ],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updatePrice = (tier: PlanTier, price: number) => {
    setTiers((prev) => prev.map((t) => (t.tier === tier ? { ...t, price_monthly: price } : t)));
    setSaved(false);
  };

  const updateFeatures = (tier: PlanTier, featuresText: string) => {
    const features = featuresText.split('\n').filter(Boolean);
    setTiers((prev) => prev.map((t) => (t.tier === tier ? { ...t, features } : t)));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    for (const tier of tiers) {
      if (tier.id) {
        await supabase
          .from('pricing_config')
          .update({ price_monthly: tier.price_monthly, features: tier.features, updated_at: new Date().toISOString() })
          .eq('id', tier.id);
      } else {
        await supabase
          .from('pricing_config')
          .update({ price_monthly: tier.price_monthly, features: tier.features, updated_at: new Date().toISOString() })
          .eq('tier', tier.tier);
      }
    }
    setSaving(false);
    setSaved(true);
    onUpdate();
    setTimeout(onClose, 1500);
  };

  // Unauthorized access notice for non-global-admin roles
  if (!canEdit) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Unauthorized Access
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Global Admin Rights Required
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-950/40 border border-red-800/50">
              <Lock className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-300">
                  Access Denied — Global Admin Privileges Required
                </p>
                <p className="text-xs text-red-400/80 mt-1">
                  The Dynamic Pricing Engine is restricted to the Global Admin
                  (Platform Owner) role only. Your current role ({userRole})
                  does not have permission to view or modify pricing
                  configuration.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0" />
              <p className="text-xs text-slate-400">
                Super-Admins, Executives, and Regional Admins are permanently
                restricted from accessing the pricing engine. This control is
                enforced at the platform level to prevent unauthorized tariff
                modifications.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="text-slate-400" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-400" />
            Dynamic Pricing Engine
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Global Admin control: edit, update, or reconfigure tier pricing
            dynamically via JSON schema. No code deployments required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {tiers.map((tier) => (
            <Card key={tier.tier} className="bg-slate-900/50 border-slate-700">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-bold text-white">{tier.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {tier.tier}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-slate-300 text-sm whitespace-nowrap">Price (monthly/vehicle)</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="bg-slate-800 border-slate-600 text-white w-24"
                      value={tier.price_monthly}
                      onChange={(e) => updatePrice(tier.tier, parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-xs text-slate-400">/mo</span>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Features (one per line)</Label>
                  <Textarea
                    className="bg-slate-800 border-slate-600 text-white text-xs min-h-[80px]"
                    value={tier.features.join('\n')}
                    onChange={(e) => updateFeatures(tier.tier, e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          {saved && (
            <span className="text-sm text-green-400 flex items-center gap-1 mr-auto">
              <CheckCircle2 className="w-4 h-4" />
              Pricing updated successfully
            </span>
          )}
          <Button variant="ghost" className="text-slate-400" onClick={onClose}>Cancel</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Pricing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
