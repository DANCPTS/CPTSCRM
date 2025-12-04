'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Send, User, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [availableRecipients, setAvailableRecipients] = useState<any[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadCampaignData();
  }, [campaignId]);

  const loadCampaignData = async () => {
    try {
      const { data: campaignData, error: campaignError } = await supabase
        .from('marketing_campaigns')
        .select('*, email_templates(*)')
        .eq('id', campaignId)
        .maybeSingle();

      if (campaignError) throw campaignError;
      if (!campaignData) {
        toast.error('Campaign not found');
        router.push('/marketing');
        return;
      }

      setCampaign(campaignData);

      const { data: recipientsData, error: recipientsError } = await supabase
        .from('campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId);

      if (recipientsError) throw recipientsError;
      setRecipients(recipientsData || []);

      if (campaignData.target_type === 'individual') {
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('candidates')
          .select('first_name, last_name, email')
          .not('email', 'is', null)
          .order('created_at', { ascending: false });

        if (candidatesError) throw candidatesError;

        const uniqueEmails = new Map();
        (candidatesData || []).forEach((candidate: any) => {
          if (candidate.email && !uniqueEmails.has(candidate.email.toLowerCase())) {
            const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
            uniqueEmails.set(candidate.email.toLowerCase(), {
              email: candidate.email,
              name: fullName || 'Unknown',
            });
          }
        });

        setAvailableRecipients(Array.from(uniqueEmails.values()));
      } else {
        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('name, email')
          .not('email', 'is', null)
          .order('created_at', { ascending: false });

        if (companiesError) throw companiesError;

        const uniqueEmails = new Map();
        (companiesData || []).forEach((company: any) => {
          if (company.email && !uniqueEmails.has(company.email.toLowerCase())) {
            uniqueEmails.set(company.email.toLowerCase(), {
              email: company.email,
              name: company.name || 'Unknown',
              company_name: company.name,
            });
          }
        });

        setAvailableRecipients(Array.from(uniqueEmails.values()));
      }
    } catch (error: any) {
      toast.error('Failed to load campaign data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecipient = (email: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedRecipients(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRecipients.size === availableRecipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(availableRecipients.map(r => r.email)));
    }
  };

  const handleAddRecipients = async () => {
    if (selectedRecipients.size === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    try {
      const newRecipients = availableRecipients
        .filter(r => selectedRecipients.has(r.email))
        .map(r => ({
          campaign_id: campaignId,
          email: r.email,
          name: r.name,
          company_name: r.company_name || null,
        }));

      const { error } = await supabase
        .from('campaign_recipients')
        .insert(newRecipients);

      if (error) throw error;

      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({ recipients_count: recipients.length + newRecipients.length })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      toast.success(`Added ${newRecipients.length} recipients`);
      setSelectedRecipients(new Set());
      loadCampaignData();
    } catch (error: any) {
      toast.error('Failed to add recipients');
      console.error(error);
    }
  };

  const handleSendCampaign = async () => {
    if (recipients.length === 0) {
      toast.error('Please add recipients before sending');
      return;
    }

    setSending(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-marketing-campaign`;
      const headers = {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ campaignId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`Campaign sent successfully to ${result.sentCount} recipients`);
        loadCampaignData();
      } else {
        toast.error('Failed to send campaign: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to send campaign:', error);
      toast.error('Failed to send campaign. Check console for details.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading campaign...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg text-gray-600">Campaign not found</p>
              <Button onClick={() => router.push('/marketing')} className="mt-4">
                Back to Marketing
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));
  const filteredAvailable = availableRecipients.filter(r => !existingEmails.has(r.email.toLowerCase()));

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push('/marketing')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketing
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{campaign.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">
                  {campaign.target_type === 'business' ? 'Businesses' : 'Individuals'}
                </Badge>
                <Badge className={campaign.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {campaign.status}
                </Badge>
              </div>
            </div>
            {campaign.status === 'draft' && recipients.length > 0 && (
              <Button onClick={handleSendCampaign} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Sending...' : 'Send Campaign'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">Template Name</div>
                <p className="font-medium">{campaign.email_templates?.name || 'N/A'}</p>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Subject</div>
                <p className="font-medium">{campaign.email_templates?.subject || 'N/A'}</p>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Body Preview</div>
                <p className="text-sm text-slate-600 line-clamp-6">{campaign.email_templates?.body || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Total Recipients</div>
                  <p className="text-2xl font-bold">{recipients.length}</p>
                </div>
                <div>
                  <div className="text-sm text-slate-500 mb-1">Sent</div>
                  <p className="text-2xl font-bold">{recipients.filter(r => r.sent).length}</p>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Created</div>
                <p className="font-medium">{format(new Date(campaign.created_at), 'PPpp')}</p>
              </div>
              {campaign.sent_at && (
                <div>
                  <div className="text-sm text-slate-500 mb-1">Sent At</div>
                  <p className="font-medium">{format(new Date(campaign.sent_at), 'PPpp')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {campaign.status === 'draft' && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Recipients</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedRecipients.size === filteredAvailable.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button onClick={handleAddRecipients} disabled={selectedRecipients.size === 0}>
                    Add {selectedRecipients.size > 0 ? `(${selectedRecipients.size})` : ''}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAvailable.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No more {campaign.target_type === 'individual' ? 'individuals' : 'businesses'} available to add
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredAvailable.map((recipient) => (
                    <div
                      key={recipient.email}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => handleToggleRecipient(recipient.email)}
                    >
                      <Checkbox
                        checked={selectedRecipients.has(recipient.email)}
                        onCheckedChange={() => handleToggleRecipient(recipient.email)}
                      />
                      <User className="h-4 w-4 text-slate-400" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{recipient.name}</p>
                        <p className="text-xs text-slate-500">{recipient.email}</p>
                        {recipient.company_name && (
                          <p className="text-xs text-slate-500">{recipient.company_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {recipients.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Current Recipients ({recipients.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{recipient.name}</p>
                      <p className="text-xs text-slate-500">{recipient.email}</p>
                      {recipient.company_name && (
                        <p className="text-xs text-slate-500">{recipient.company_name}</p>
                      )}
                    </div>
                    {recipient.sent && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Sent
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
