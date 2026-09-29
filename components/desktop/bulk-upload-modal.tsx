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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, CheckCircle2, FileSpreadsheet, Users, Send, Plus } from 'lucide-react';
import type { Company } from '@/lib/types';

interface BulkUploadModalProps {
  companies: Company[];
  onClose: () => void;
}

export function BulkUploadModal({ companies, onClose }: BulkUploadModalProps) {
  const [csvText, setCsvText] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [imported, setImported] = useState<{ trucks: number; drivers: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Manual add fields
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [driverPin, setDriverPin] = useState('');
  const [driverNumber, setDriverNumber] = useState('');

  const sampleCSV = `truck_number,driver_name,driver_email,driver_number,pin_code,location,chassis_type,hardware_profile
TRK-401,Robert Martinez,r.martinez@company.com,DRV-005,1234,Dallas TX,class8_tractor,c55_pro_forward_lr_rear
TRK-402,Linda Park,l.park@company.com,DRV-006,5678,Dallas TX,class7_box,c55_pro_forward_r
TRK-403,David Kim,d.kim@company.com,DRV-007,9012,Houston TX,class8_tractor,c93_us4_gap_lane`;

  const parseAndImport = async () => {
    setImporting(true);
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      setImporting(false);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    let truckCount = 0;
    let driverCount = 0;
    const company = companies.find((c) => c.id === companyId);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = values[j] || ''; });

      // Create driver
      const { data: driver } = await supabase.from('drivers').insert({
        company_id: companyId || null,
        name: row.driver_name,
        email: row.driver_email,
        driver_number: row.driver_number,
        pin_code: row.pin_code,
        location: row.location,
        company_name: company?.name || null,
        status: 'active',
      }).select().single();
      if (driver) driverCount++;

      // Create vehicle
      await supabase.from('vehicles').insert({
        company_id: companyId || null,
        truck_number: row.truck_number,
        chassis_type: row.chassis_type || 'class8_tractor',
        hardware_profile: row.hardware_profile || 'c55_pro_forward',
        assigned_driver_id: driver?.id || null,
        company_name: company?.name || null,
        location: row.location,
        status: 'operational',
        plan_tier: company?.plan_tier || 'basic',
      });
      truckCount++;
    }

    setImported({ trucks: truckCount, drivers: driverCount });
    setImporting(false);
  };

  const addManual = async () => {
    if (!truckNumber) return;
    const company = companies.find((c) => c.id === companyId);
    const { data: driver } = await supabase.from('drivers').insert({
      company_id: companyId || null,
      name: driverName,
      email: driverEmail,
      driver_number: driverNumber,
      pin_code: driverPin,
      location: company?.location || null,
      company_name: company?.name || null,
      status: 'active',
    }).select().single();

    await supabase.from('vehicles').insert({
      company_id: companyId || null,
      truck_number: truckNumber,
      chassis_type: 'class8_tractor',
      hardware_profile: 'c55_pro_forward',
      assigned_driver_id: driver?.id || null,
      company_name: company?.name || null,
      location: company?.location || null,
      status: 'operational',
      plan_tier: company?.plan_tier || 'basic',
    });

    setImported({ trucks: 1, drivers: 1 });
    setTruckNumber('');
    setDriverName('');
    setDriverEmail('');
    setDriverPin('');
    setDriverNumber('');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-orange-400" />
            Bulk Group Fleet Upload
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Import unlimited trucks and drivers as a GROUP via CSV. No quota restrictions.
          </DialogDescription>
        </DialogHeader>

        {imported ? (
          <div className="py-4">
            <div className="flex items-center gap-2 p-4 rounded-lg bg-green-950/40 border border-green-800/40 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-sm font-semibold text-green-300">
                  Successfully imported {imported.trucks} trucks and {imported.drivers} drivers
                </p>
                <p className="text-xs text-green-400/70">All vehicles provisioned with unlimited capacity.</p>
              </div>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-300">Target Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={!showManual ? 'default' : 'outline'}
                className={!showManual ? 'bg-orange-500 text-white' : 'text-slate-300 border-slate-600'}
                onClick={() => setShowManual(false)}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                CSV Import
              </Button>
              <Button
                variant={showManual ? 'default' : 'outline'}
                className={showManual ? 'bg-orange-500 text-white' : 'text-slate-300 border-slate-600'}
                onClick={() => setShowManual(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Single Vehicle
              </Button>
            </div>

            {!showManual ? (
              <>
                <div>
                  <Label className="text-slate-300">CSV Data (paste or type)</Label>
                  <Textarea
                    className="bg-slate-900/50 border-slate-600 text-white text-xs font-mono min-h-[180px]"
                    placeholder={sampleCSV}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                  />
                </div>
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-400 mb-1 font-semibold">CSV Format:</p>
                    <p className="text-xs text-slate-500 font-mono">truck_number,driver_name,driver_email,driver_number,pin_code,location,chassis_type,hardware_profile</p>
                  </CardContent>
                </Card>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={parseAndImport}
                  disabled={importing || !csvText.trim()}
                >
                  {importing ? 'Importing...' : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Fleet Group
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-300">Truck #</Label>
                    <Input className="bg-slate-900/50 border-slate-600 text-white" value={truckNumber} onChange={(e) => setTruckNumber(e.target.value)} placeholder="TRK-500" />
                  </div>
                  <div>
                    <Label className="text-slate-300">Driver Name</Label>
                    <Input className="bg-slate-900/50 border-slate-600 text-white" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="John Smith" />
                  </div>
                  <div>
                    <Label className="text-slate-300">Driver Email</Label>
                    <Input className="bg-slate-900/50 border-slate-600 text-white" value={driverEmail} onChange={(e) => setDriverEmail(e.target.value)} placeholder="driver@co.com" />
                  </div>
                  <div>
                    <Label className="text-slate-300">Driver #</Label>
                    <Input className="bg-slate-900/50 border-slate-600 text-white" value={driverNumber} onChange={(e) => setDriverNumber(e.target.value)} placeholder="DRV-010" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">PIN Code</Label>
                  <Input className="bg-slate-900/50 border-slate-600 text-white" maxLength={4} value={driverPin} onChange={(e) => setDriverPin(e.target.value)} placeholder="1234" />
                </div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={addManual}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vehicle &amp; Driver
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" className="text-slate-400" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
