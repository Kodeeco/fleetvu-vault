'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  Mail,
  Users,
  Building2,
  MapPin,
  GitBranch,
} from 'lucide-react';
import type { AccessRequest } from '@/lib/types';

const ROUTING_STYLES: Record<string, string> = {
  'Local Location Admin': 'bg-blue-600 text-white',
  'Regional Director': 'bg-orange-600 text-white',
  'Super Admin': 'bg-purple-600 text-white',
};

export function AccessRequestQueue({
  selectedRegion = null,
  selectedLocation = null,
}: {
  selectedRegion?: string | null;
  selectedLocation?: string | null;
}) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRequests(data as AccessRequest[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (req: AccessRequest) => {
    const masterKey = `FV-MK-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const tempCreds = {
      username: req.requester_email,
      tempPassword: Math.random().toString(36).substring(2, 10),
      accessLink: `https://fleetvu.com/portal/access?k=${masterKey}`,
    };

    await supabase
      .from('access_requests')
      .update({
        status: 'approved',
        reviewed_by: 'admin',
        reviewed_at: new Date().toISOString(),
        temporary_credentials: tempCreds,
        master_key: masterKey,
      })
      .eq('id', req.id);

    await supabase.from('audit_logs').insert({
      actor_role: 'super_admin',
      actor_email: 'admin@fleetvu.com',
      action_type: 'access_granted',
      entity_type: 'access_request',
      entity_id: req.id,
      new_state: { master_key: masterKey, email: req.requester_email, routing_target: req.routing_target },
    });

    load();
  };

  const deny = async (req: AccessRequest) => {
    await supabase
      .from('access_requests')
      .update({
        status: 'denied',
        reviewed_by: 'admin',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.id);

    await supabase.from('audit_logs').insert({
      actor_role: 'super_admin',
      actor_email: 'admin@fleetvu.com',
      action_type: 'access_denied',
      entity_type: 'access_request',
      entity_id: req.id,
    });

    load();
  };

  const isFiltered = selectedRegion || selectedLocation;

  const filteredRequests = requests.filter((r) => {
    if (!isFiltered) return true;
    const matchesRegion = !selectedRegion || r.region === selectedRegion || r.region?.includes(selectedRegion.split(' ')[0]);
    const matchesLocation = !selectedLocation || r.location_facility === selectedLocation;
    return matchesRegion && matchesLocation;
  });

  const pending = filteredRequests.filter((r) => r.status === 'pending');
  const reviewed = filteredRequests.filter((r) => r.status !== 'pending');

  return (
    <div className="p-6 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Access Request Queue</h2>
          <p className="text-sm text-slate-400">
            Review and approve portal access requests. Each request is
            automatically routed based on the requested scope. Approval
            dispatches temporary credentials and a cryptographic Master Key.
          </p>
          {isFiltered && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <Badge className="bg-blue-600 text-white">
                Filtered: {selectedRegion || 'All Regions'}{selectedLocation ? ` · ${selectedLocation}` : ''}
              </Badge>
              <span className="text-slate-500">Showing {filteredRequests.length} of {requests.length} total requests</span>
            </div>
          )}
        </div>

        {loading && <p className="text-slate-400 text-sm">Loading requests...</p>}

        {!loading && pending.length === 0 && reviewed.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8 text-center text-slate-400">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              No access requests yet.
            </CardContent>
          </Card>
        )}

        {pending.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Requests ({pending.length})
            </h3>
            {pending.map((req) => (
              <Card key={req.id} className="bg-slate-800/50 border-slate-700 border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-bold text-white">{req.requester_name}</span>
                        {req.role_requested && (
                          <Badge variant="outline" className="text-xs">{req.role_requested}</Badge>
                        )}
                        {req.routing_target && (
                          <Badge className={`text-xs ${ROUTING_STYLES[req.routing_target] || 'bg-slate-600 text-white'}`}>
                            <GitBranch className="w-3 h-3 mr-1" />
                            Routed: {req.routing_target}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <Mail className="w-3 h-3" />
                        {req.requester_email}
                      </div>
                      {req.company_name && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                          <Building2 className="w-3 h-3" />
                          {req.company_name}
                        </div>
                      )}
                      {req.region && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                          <MapPin className="w-3 h-3" />
                          {req.region}
                          {req.location_facility && (
                            <span className="text-slate-500"> · {req.location_facility}</span>
                          )}
                        </div>
                      )}
                      {req.request_reason && (
                        <p className="text-xs text-slate-500 mt-2 italic">&ldquo;{req.request_reason}&rdquo;</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-3">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approve(req)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-400 border-red-800 hover:bg-red-950/30" onClick={() => deny(req)}>
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {reviewed.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-400">Reviewed Requests</h3>
            {reviewed.map((req) => (
              <Card key={req.id} className="bg-slate-800/30 border-slate-700/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white">{req.requester_name}</span>
                    <span className="text-xs text-slate-400">{req.requester_email}</span>
                    {req.routing_target && (
                      <Badge variant="outline" className="text-xs text-slate-400">
                        {req.routing_target}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {req.status === 'approved' && req.master_key && (
                      <>
                        <Badge className="bg-green-600 text-white">
                          <KeyRound className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                        <span className="text-xs font-mono text-orange-400/70">{req.master_key}</span>
                      </>
                    )}
                    {req.status === 'denied' && (
                      <Badge className="bg-red-600 text-white">Rejected</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
