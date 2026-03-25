'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Send, User, Mail, CircleCheck as CheckCircle, Eye, CreditCard as Edit2, Code, Image, Upload, Loader as Loader2, FileSpreadsheet, Building2, Trash2, X, Sparkles, MousePointer, TriangleAlert as AlertTriangle, Ban, Flag, TrendingUp, Users, ChartBar as BarChart3, Link2, ExternalLink, UsersRound, MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/rich-text-editor';
import { EmailPreview } from '@/components/email-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

function StatCard({ label, value, percentage, icon: Icon, color, subLabel }: {
  label: string;
  value: number;
  percentage?: number;
  icon: any;
  color: string;
  subLabel?: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; bar: string }> = {
    green: { bg: 'bg-green-50', text: 'text-green-600', bar: 'bg-green-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-500' },
    red: { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', bar: 'bg-yellow-500' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', bar: 'bg-slate-400' },
  };

  const colors = colorClasses[color] || colorClasses.slate;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <Icon className={`h-4 w-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-600 leading-tight">{label}</div>
          {subLabel && <div className="text-xs text-slate-400 leading-tight">{subLabel}</div>}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-slate-900">{value}</div>
          {percentage !== undefined && (
            <div className={`text-base font-semibold ${colors.text}`}>{percentage.toFixed(2)}%</div>
          )}
        </div>
        {percentage !== undefined && (
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignStatsCard({ campaign, recipients, linkClicks, onToggleReplied }: {
  campaign: any;
  recipients: any[];
  linkClicks: any[];
  onToggleReplied: (recipientId: string, currentlyReplied: boolean) => void;
}) {
  const sentCount = recipients.filter(r => r.sent).length;
  const openedCount = recipients.filter(r => r.opened_at).length;
  const clickedCount = recipients.filter(r => r.clicked_at).length;
  const repliedCount = recipients.filter(r => r.replied_at).length;
  const unsubscribedCount = recipients.filter(r => r.unsubscribed_at).length;
  const bouncedHardCount = recipients.filter(r => r.bounce_type === 'hard').length;
  const bouncedSoftCount = recipients.filter(r => r.bounce_type === 'soft').length;
  const spamCount = recipients.filter(r => r.spam_reported_at).length;

  const openRate = sentCount > 0 ? (openedCount / sentCount) * 100 : 0;
  const clickRate = sentCount > 0 ? (clickedCount / sentCount) * 100 : 0;
  const clickToOpenRate = openedCount > 0 ? (clickedCount / openedCount) * 100 : 0;
  const replyRate = sentCount > 0 ? (repliedCount / sentCount) * 100 : 0;
  const unsubscribeRate = sentCount > 0 ? (unsubscribedCount / sentCount) * 100 : 0;
  const hardBounceRate = sentCount > 0 ? (bouncedHardCount / sentCount) * 100 : 0;
  const softBounceRate = sentCount > 0 ? (bouncedSoftCount / sentCount) * 100 : 0;
  const spamRate = sentCount > 0 ? (spamCount / sentCount) * 100 : 0;

  const linkStats = linkClicks.reduce((acc: Record<string, number>, click) => {
    const url = click.url || 'Unknown';
    acc[url] = (acc[url] || 0) + 1;
    return acc;
  }, {});

  const sortedLinks = Object.entries(linkStats)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 10);

  const [activeTab, setActiveTab] = useState('summary');

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BarChart3 className="h-6 w-6 text-slate-700" />
            Campaign Report
          </CardTitle>
          {campaign.sent_at && (
            <Badge variant="outline" className="text-slate-600 font-normal px-3 py-1">
              Sent {format(new Date(campaign.sent_at), 'PPp')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-slate-50 p-1">
            <TabsTrigger value="summary" className="data-[state=active]:bg-white">Summary</TabsTrigger>
            <TabsTrigger value="recipients" className="data-[state=active]:bg-white">Recipients Activity</TabsTrigger>
            <TabsTrigger value="links" className="data-[state=active]:bg-white">Link Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-5 mt-6">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-6 text-center">
              <div className="text-sm font-medium text-slate-500 mb-2">Total Emails Sent</div>
              <div className="text-5xl font-bold text-slate-900">{sentCount}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Opened"
                value={openedCount}
                percentage={openRate}
                icon={Eye}
                color="green"
              />
              <StatCard
                label="Clicked"
                value={clickedCount}
                percentage={clickRate}
                icon={MousePointer}
                color="blue"
              />
              <StatCard
                label="Replied"
                value={repliedCount}
                percentage={replyRate}
                icon={MessageSquare}
                color="orange"
              />
              <StatCard
                label="Click to Open"
                value={clickedCount}
                percentage={clickToOpenRate}
                icon={TrendingUp}
                color="slate"
                subLabel="of openers"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Unsubscribed"
                value={unsubscribedCount}
                percentage={unsubscribeRate}
                icon={Ban}
                color="slate"
              />
              <StatCard
                label="Hard Bounces"
                value={bouncedHardCount}
                percentage={hardBounceRate}
                icon={AlertTriangle}
                color="red"
              />
              <StatCard
                label="Soft Bounces"
                value={bouncedSoftCount}
                percentage={softBounceRate}
                icon={AlertTriangle}
                color="yellow"
              />
              <StatCard
                label="Spam Reports"
                value={spamCount}
                percentage={spamRate}
                icon={Flag}
                color="red"
              />
            </div>
          </TabsContent>

          <TabsContent value="recipients" className="space-y-3 mt-6">
            <div className="flex items-center gap-4 text-sm bg-slate-50 rounded-lg p-3 mb-4">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Users className="h-4 w-4" />
                <span className="font-medium">{recipients.length}</span> total
              </span>
              <span className="flex items-center gap-1.5 text-green-600">
                <Eye className="h-4 w-4" />
                <span className="font-medium">{openedCount}</span> opened
              </span>
              <span className="flex items-center gap-1.5 text-blue-600">
                <MousePointer className="h-4 w-4" />
                <span className="font-medium">{clickedCount}</span> clicked
              </span>
              <span className="flex items-center gap-1.5 text-orange-600">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">{repliedCount}</span> replied
              </span>
            </div>
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
              {recipients.map((recipient) => (
                <div
                  key={recipient.id}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-slate-900 truncate">{recipient.name}</p>
                      <p className="text-xs text-slate-500 truncate">{recipient.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end ml-4">
                    {recipient.sent && (
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sent
                      </Badge>
                    )}
                    {recipient.opened_at && (
                      <Badge className="bg-green-100 text-green-700 text-xs whitespace-nowrap">
                        <Eye className="h-3 w-3 mr-1" />
                        Opened {recipient.open_count > 1 ? `(${recipient.open_count}x)` : ''}
                      </Badge>
                    )}
                    {recipient.clicked_at && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs whitespace-nowrap">
                        <MousePointer className="h-3 w-3 mr-1" />
                        Clicked {recipient.click_count > 1 ? `(${recipient.click_count}x)` : ''}
                      </Badge>
                    )}
                    {recipient.replied_at && (
                      <Badge className="bg-orange-100 text-orange-700 text-xs whitespace-nowrap">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Replied
                      </Badge>
                    )}
                    {recipient.unsubscribed_at && (
                      <Badge className="bg-slate-100 text-slate-700 text-xs whitespace-nowrap">
                        <Ban className="h-3 w-3 mr-1" />
                        Unsubscribed
                      </Badge>
                    )}
                    {recipient.bounce_type && (
                      <Badge className={recipient.bounce_type === 'hard' ? 'bg-red-100 text-red-700 text-xs' : 'bg-yellow-100 text-yellow-700 text-xs whitespace-nowrap'}>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {recipient.bounce_type === 'hard' ? 'Hard Bounce' : 'Soft Bounce'}
                      </Badge>
                    )}
                    {recipient.spam_reported_at && (
                      <Badge className="bg-red-100 text-red-700 text-xs whitespace-nowrap">
                        <Flag className="h-3 w-3 mr-1" />
                        Spam
                      </Badge>
                    )}
                    {recipient.sent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-xs ${recipient.replied_at ? 'text-orange-600 hover:text-orange-700' : 'text-slate-400 hover:text-slate-600'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleReplied(recipient.id, !!recipient.replied_at);
                        }}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {recipient.replied_at ? 'Unmark Reply' : 'Mark Replied'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="links" className="space-y-3 mt-6">
            <div className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg p-3 mb-4">
              <Link2 className="h-4 w-4 text-slate-600" />
              <span className="text-slate-600">
                <span className="font-medium">{linkClicks.length}</span> total clicks on{' '}
                <span className="font-medium">{sortedLinks.length}</span> unique links
              </span>
            </div>
            {sortedLinks.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <MousePointer className="h-8 w-8" />
                </div>
                <p className="font-medium">No link clicks recorded yet</p>
                <p className="text-sm mt-1">Link tracking will appear here once recipients click links in your emails</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {sortedLinks.map(([url, count], index) => (
                  <div
                    key={url}
                    className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-semibold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5 group"
                      >
                        <span className="truncate">{url.length > 70 ? url.substring(0, 70) + '...' : url}</span>
                        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-50 group-hover:opacity-100" />
                      </a>
                      <div className="text-xs text-slate-400 mt-0.5">Click to visit</div>
                    </div>
                    <Badge variant="outline" className="font-semibold text-slate-700 whitespace-nowrap">
                      {count as number} {(count as number) === 1 ? 'click' : 'clicks'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editTemplateOpen, setEditTemplateOpen] = useState(false);
  const [editingBody, setEditingBody] = useState('');
  const [editingSubject, setEditingSubject] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelRecipients, setExcelRecipients] = useState<{email: string; name: string; company_name?: string}[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [linkClicks, setLinkClicks] = useState<any[]>([]);
  const [activeReportTab, setActiveReportTab] = useState('summary');
  const [sendProgress, setSendProgress] = useState<{
    totalSent: number;
    totalRecipients: number;
    remaining: number;
    errors: string[];
    startedAt: number | null;
    lastBatchAt: number | null;
    status: 'idle' | 'sending' | 'complete' | 'error' | 'timeout';
  }>({
    totalSent: 0,
    totalRecipients: 0,
    remaining: 0,
    errors: [],
    startedAt: null,
    lastBatchAt: null,
    status: 'idle',
  });
  const editTemplateActionRef = useRef(false);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExt)) {
      toast.error('Please select an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setUploadingExcel(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        toast.error('File must have a header row and at least one data row');
        return;
      }

      const headerRow = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());

      const emailIndex = headerRow.findIndex(h => h.includes('email'));
      const nameIndex = headerRow.findIndex(h => h.includes('name') && !h.includes('company') && !h.includes('first') && !h.includes('last'));
      const firstNameIndex = headerRow.findIndex(h => h === 'first name' || h === 'firstname' || h === 'first_name' || h === 'first');
      const lastNameIndex = headerRow.findIndex(h => h === 'last name' || h === 'lastname' || h === 'last_name' || h === 'last' || h === 'surname');
      const companyIndex = headerRow.findIndex(h => h.includes('company') || h.includes('business') || h.includes('organisation') || h.includes('organization'));

      if (emailIndex === -1) {
        toast.error(`File must have an "Email" column. Found columns: ${headerRow.join(', ')}`);
        return;
      }

      const parsed: {email: string; name: string; company_name?: string}[] = [];
      const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const emailValue = row[emailIndex];
        const email = String(emailValue || '').trim().toLowerCase();

        if (email && email.includes('@') && !existingEmails.has(email)) {
          let name = '';
          if (firstNameIndex !== -1 || lastNameIndex !== -1) {
            const firstName = firstNameIndex !== -1 ? String(row[firstNameIndex] || '').trim() : '';
            const lastName = lastNameIndex !== -1 ? String(row[lastNameIndex] || '').trim() : '';
            name = `${firstName} ${lastName}`.trim();
          } else if (nameIndex !== -1) {
            name = String(row[nameIndex] || '').trim();
          }

          const companyName = companyIndex !== -1 ? String(row[companyIndex] || '').trim() : undefined;

          parsed.push({
            email,
            name: name || email.split('@')[0],
            company_name: companyName || undefined,
          });
          existingEmails.add(email);
        }
      }

      if (parsed.length === 0) {
        toast.error('No valid new email addresses found in the file');
        return;
      }

      setExcelRecipients(parsed);
      toast.success(`Found ${parsed.length} valid contacts to add`);
    } catch (error: any) {
      toast.error('Failed to parse file: ' + error.message);
    } finally {
      setUploadingExcel(false);
      e.target.value = '';
    }
  };

  const handleAddExcelRecipients = async () => {
    if (excelRecipients.length === 0) return;

    try {
      const newRecipients = excelRecipients.map(r => ({
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

      toast.success(`Added ${newRecipients.length} recipients from Excel`);
      setExcelRecipients([]);
      loadCampaignData();
    } catch (error: any) {
      toast.error('Failed to add recipients: ' + error.message);
    }
  };

  const handleRemoveExcelRecipient = (email: string) => {
    setExcelRecipients(prev => prev.filter(r => r.email !== email));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('marketing-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('marketing-images')
        .getPublicUrl(fileName);

      const imgTag = `<img src="${publicUrl}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
      setEditingBody(prev => prev + '\n' + imgTag);
      toast.success('Image uploaded and inserted');
    } catch (error: any) {
      toast.error('Failed to upload image: ' + error.message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

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

      const { count: totalCount } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      const allRecipients: any[] = [];
      const PAGE_SIZE = 1000;
      const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

      for (let page = 0; page < totalPages; page++) {
        const { data: recipientsData, error: recipientsError } = await supabase
          .from('campaign_recipients')
          .select('*')
          .eq('campaign_id', campaignId)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (recipientsError) throw recipientsError;
        if (recipientsData) allRecipients.push(...recipientsData);
      }

      setRecipients(allRecipients);

      const allLinkClicks: any[] = [];
      let clickPage = 0;
      let clickHasMore = true;
      while (clickHasMore) {
        const { data: clickBatch } = await supabase
          .from('email_link_clicks')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('clicked_at', { ascending: false })
          .range(clickPage * 1000, (clickPage + 1) * 1000 - 1);
        if (clickBatch) allLinkClicks.push(...clickBatch);
        clickHasMore = (clickBatch?.length || 0) === 1000;
        clickPage++;
      }

      setLinkClicks(allLinkClicks);

      const [candidatesRes, contactsRes] = await Promise.all([
        supabase.from('candidates').select('first_name, last_name, email').not('email', 'is', null).order('created_at', { ascending: false }),
        supabase.from('contacts').select('first_name, last_name, email, companies(name)').not('email', 'is', null).order('created_at', { ascending: false }),
      ]);

      const uniqueEmails = new Map();
      (candidatesRes.data || []).forEach((c: any) => {
        if (c.email && !uniqueEmails.has(c.email.toLowerCase())) {
          uniqueEmails.set(c.email.toLowerCase(), {
            email: c.email, name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown', _source: 'candidate',
          });
        }
      });
      (contactsRes.data || []).forEach((c: any) => {
        if (c.email && !uniqueEmails.has(c.email.toLowerCase())) {
          uniqueEmails.set(c.email.toLowerCase(), {
            email: c.email, name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown', company_name: c.companies?.name || null, _source: 'contact',
          });
        }
      });
      setAvailableRecipients(Array.from(uniqueEmails.values()));
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

  const handleRetryCampaign = async () => {
    try {
      const { error: resetRecipientsError } = await supabase
        .from('campaign_recipients')
        .update({ sent: false, delivery_status: 'pending' })
        .eq('campaign_id', campaignId)
        .eq('delivery_status', 'failed');

      if (resetRecipientsError) throw resetRecipientsError;

      const { error: resetCampaignError } = await supabase
        .from('marketing_campaigns')
        .update({ status: 'draft', sent_at: null })
        .eq('id', campaignId);

      if (resetCampaignError) throw resetCampaignError;

      toast.success('Campaign reset - ready to resend');
      await loadCampaignData();
      handleSendCampaign();
    } catch (error: any) {
      toast.error('Failed to reset campaign: ' + error.message);
    }
  };

  const handleSendCampaign = async () => {
    if (recipients.length === 0) {
      toast.error('Please add recipients before sending');
      return;
    }

    const unsent = recipients.filter(r => !r.sent).length;
    setSending(true);
    setSendProgress({
      totalSent: 0,
      totalRecipients: unsent,
      remaining: unsent,
      errors: [],
      startedAt: Date.now(),
      lastBatchAt: Date.now(),
      status: 'sending',
    });

    let totalSent = 0;
    let hasError = false;
    const collectedErrors: string[] = [];

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-marketing-campaign`;
      const headers = {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      let noProgressCount = 0;
      const TIMEOUT_MS = 120000;

      while (!hasError) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ campaignId }),
            signal: controller.signal,
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            collectedErrors.push('Request timed out after 2 minutes. The server may be overloaded.');
            setSendProgress(prev => ({ ...prev, status: 'timeout', errors: [...collectedErrors] }));
          } else {
            collectedErrors.push(`Network error: ${fetchErr.message}`);
            setSendProgress(prev => ({ ...prev, status: 'error', errors: [...collectedErrors] }));
          }
          hasError = true;
          break;
        }
        clearTimeout(timeoutId);

        let result: any;
        try {
          result = await response.json();
        } catch {
          collectedErrors.push(`Server returned invalid response (status ${response.status})`);
          setSendProgress(prev => ({ ...prev, status: 'error', errors: [...collectedErrors] }));
          hasError = true;
          break;
        }

        if (!result.success) {
          collectedErrors.push(result.error || 'Unknown error');
          setSendProgress(prev => ({
            ...prev,
            status: 'error',
            errors: [...collectedErrors],
          }));
          hasError = true;
          break;
        }

        if (result.errors) {
          collectedErrors.push(...result.errors);
        }

        if (result.sentCount === 0 && !result.complete) {
          noProgressCount++;
          if (noProgressCount >= 3) {
            collectedErrors.push('Campaign sending stalled - emails are failing to send. Check your SMTP settings.');
            setSendProgress(prev => ({ ...prev, status: 'error', errors: [...collectedErrors] }));
            hasError = true;
            break;
          }
        } else {
          noProgressCount = 0;
        }

        totalSent += result.sentCount;
        const remaining = result.remaining || 0;

        setSendProgress(prev => ({
          ...prev,
          totalSent,
          remaining,
          lastBatchAt: Date.now(),
          errors: [...collectedErrors],
        }));

        if (result.complete) {
          setSendProgress(prev => ({
            ...prev,
            totalSent,
            remaining: 0,
            status: totalSent > 0 ? 'complete' : 'error',
            errors: totalSent === 0 ? [...collectedErrors, 'No emails could be sent. Check your SMTP settings.'] : [...collectedErrors],
          }));
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      loadCampaignData();
    } catch (error: any) {
      console.error('Failed to send campaign:', error);
      setSendProgress(prev => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, `Unexpected error: ${error.message}`],
      }));
    } finally {
      setSending(false);
    }
  };

  const handleToggleReplied = async (recipientId: string, currentlyReplied: boolean) => {
    try {
      const { error } = await supabase
        .from('campaign_recipients')
        .update({ replied_at: currentlyReplied ? null : new Date().toISOString() })
        .eq('id', recipientId);

      if (error) throw error;

      setRecipients(prev => prev.map(r =>
        r.id === recipientId
          ? { ...r, replied_at: currentlyReplied ? null : new Date().toISOString() }
          : r
      ));

      toast.success(currentlyReplied ? 'Reply unmarked' : 'Marked as replied');
    } catch (error: any) {
      toast.error('Failed to update: ' + error.message);
    }
  };

  const handleOpenEditTemplate = () => {
    if (campaign?.email_templates) {
      setEditingSubject(campaign.email_templates.subject || '');
      setEditingBody(campaign.email_templates.body || '');
      setEditTemplateOpen(true);
    }
  };

  const handleSaveTemplate = async () => {
    if (!campaign?.email_templates?.id) return;

    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: editingSubject,
          body: editingBody,
        })
        .eq('id', campaign.email_templates.id);

      if (error) throw error;

      toast.success('Template updated successfully');
      editTemplateActionRef.current = true;
      setEditTemplateOpen(false);
      loadCampaignData();
    } catch (error: any) {
      toast.error('Failed to update template');
      console.error(error);
    } finally {
      setSavingTemplate(false);
    }
  };

  const autoSaveTemplate = async () => {
    if (!campaign?.email_templates?.id) return;
    try {
      await supabase
        .from('email_templates')
        .update({
          subject: editingSubject,
          body: editingBody,
        })
        .eq('id', campaign.email_templates.id);
      toast.success('Template changes saved');
      loadCampaignData();
    } catch (error: any) {
      console.error('Failed to auto-save template:', error);
    }
  };

  const handleAiModify = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter instructions for the AI');
      return;
    }

    setGeneratingAi(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-marketing-email`;
      const headers = {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: aiPrompt,
          existingSubject: editingSubject,
          existingBody: editingBody,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setEditingSubject(result.subject);
        setEditingBody(result.body);
        setAiPrompt('');
        toast.success('Email updated by AI');
      } else {
        toast.error('Failed to modify email: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to modify email with AI:', error);
      toast.error('Failed to modify email. Check console for details.');
    } finally {
      setGeneratingAi(false);
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

  const progressPercent = sendProgress.totalRecipients > 0
    ? Math.round((sendProgress.totalSent / sendProgress.totalRecipients) * 100)
    : 0;

  const elapsedSeconds = sendProgress.startedAt
    ? Math.floor((Date.now() - sendProgress.startedAt) / 1000)
    : 0;

  return (
    <AppShell>
      <div className="p-8">
        {sendProgress.status !== 'idle' && (
          <div className={`mb-6 rounded-lg border-2 overflow-hidden ${
            sendProgress.status === 'complete' ? 'border-green-300 bg-green-50' :
            sendProgress.status === 'error' || sendProgress.status === 'timeout' ? 'border-red-300 bg-red-50' :
            'border-blue-300 bg-blue-50'
          }`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {sendProgress.status === 'sending' && (
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  )}
                  {sendProgress.status === 'complete' && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {(sendProgress.status === 'error' || sendProgress.status === 'timeout') && (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-semibold text-lg ${
                    sendProgress.status === 'complete' ? 'text-green-800' :
                    sendProgress.status === 'error' || sendProgress.status === 'timeout' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {sendProgress.status === 'sending' && 'Sending Campaign...'}
                    {sendProgress.status === 'complete' && 'Campaign Sent Successfully'}
                    {sendProgress.status === 'error' && 'Campaign Failed'}
                    {sendProgress.status === 'timeout' && 'Request Timed Out'}
                  </span>
                </div>
                {(sendProgress.status === 'complete' || sendProgress.status === 'error' || sendProgress.status === 'timeout') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSendProgress(prev => ({ ...prev, status: 'idle' }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm mb-3">
                <span className={
                  sendProgress.status === 'complete' ? 'text-green-700' :
                  sendProgress.status === 'error' || sendProgress.status === 'timeout' ? 'text-red-700' :
                  'text-blue-700'
                }>
                  <span className="font-bold text-2xl">{sendProgress.totalSent}</span>
                  <span className="mx-1">/</span>
                  <span>{sendProgress.totalRecipients} sent</span>
                </span>
                {sendProgress.remaining > 0 && sendProgress.status === 'sending' && (
                  <span className="text-blue-600">{sendProgress.remaining} remaining</span>
                )}
              </div>

              <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    sendProgress.status === 'complete' ? 'bg-green-500' :
                    sendProgress.status === 'error' || sendProgress.status === 'timeout' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-slate-500">{progressPercent}%</span>
              </div>

              {sendProgress.errors.length > 0 && (
                <div className="mt-4 p-3 bg-white/80 rounded-md border border-red-200">
                  <div className="text-sm font-medium text-red-800 mb-1">Errors ({sendProgress.errors.length})</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {sendProgress.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">-</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sendProgress.status === 'timeout' && (
                <div className="mt-3 text-sm text-red-700">
                  You can press Resume Sending to continue where it left off. Already-sent emails will not be re-sent.
                </div>
              )}
              {sendProgress.status === 'error' && sendProgress.totalSent > 0 && (
                <div className="mt-3 text-sm text-red-700">
                  {sendProgress.totalSent} emails were sent before the error. You can retry to send the remaining {sendProgress.remaining}.
                </div>
              )}
            </div>
          </div>
        )}

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
                <Badge className={campaign.status === 'sent' ? 'bg-green-100 text-green-800' : campaign.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                  {campaign.status}
                </Badge>
                {campaign.audience_id && (
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-slate-100 flex items-center gap-1"
                    onClick={() => router.push(`/marketing/audiences/${campaign.audience_id}`)}
                  >
                    <UsersRound className="h-3 w-3" />
                    Linked Audience
                  </Badge>
                )}
              </div>
            </div>
            {campaign.status === 'draft' && recipients.length > 0 && (
              <Button onClick={handleSendCampaign} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Sending...' : 'Send Campaign'}
              </Button>
            )}
            {campaign.status === 'sending' && (
              <Button onClick={handleSendCampaign} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Sending...' : 'Resume Sending'}
              </Button>
            )}
            {campaign.status === 'failed' && (
              <div className="flex items-center gap-3">
                <Badge className="bg-red-100 text-red-700 px-3 py-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
                <Button onClick={handleRetryCampaign} disabled={sending} variant="default">
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? 'Retrying...' : 'Retry Campaign'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Email Template</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenEditTemplate}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
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
                <div
                  className="text-sm text-slate-600 line-clamp-6 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: campaign.email_templates?.body || 'N/A' }}
                />
              </div>
            </CardContent>
          </Card>

          <CampaignStatsCard
            campaign={campaign}
            recipients={recipients}
            linkClicks={linkClicks}
            onToggleReplied={handleToggleReplied}
          />
        </div>

        {(campaign.status === 'draft' || campaign.status === 'failed') && (
          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Upload from Excel/CSV
                  </CardTitle>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="hidden"
                      disabled={uploadingExcel}
                    />
                    <Button variant="outline" asChild disabled={uploadingExcel}>
                      <span>
                        {uploadingExcel ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploadingExcel ? 'Processing...' : 'Upload File'}
                      </span>
                    </Button>
                  </label>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 mb-4">
                  Upload a CSV or Excel file with columns: <strong>Email</strong> (required), <strong>Name</strong> or <strong>First Name/Last Name</strong>, and optionally <strong>Company</strong>.
                </p>

                {excelRecipients.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{excelRecipients.length} contacts ready to add</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setExcelRecipients([])}>
                          <X className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                        <Button size="sm" onClick={handleAddExcelRecipients}>
                          Add All ({excelRecipients.length})
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2 bg-slate-50">
                      {excelRecipients.map((recipient) => (
                        <div
                          key={recipient.email}
                          className="flex items-center justify-between p-2 bg-white rounded border"
                        >
                          <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-medium text-sm">{recipient.name}</p>
                              <p className="text-xs text-slate-500">{recipient.email}</p>
                              {recipient.company_name && (
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {recipient.company_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveExcelRecipient(recipient.email)}
                          >
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Add from CRM
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={filteredAvailable.length === 0}>
                      {selectedRecipients.size === filteredAvailable.length && filteredAvailable.length > 0 ? 'Deselect All' : 'Select All'}
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
                    No more contacts available to add
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
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {recipient.company_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
                    <div className="flex items-center gap-2">
                      {recipient.delivery_status === 'skipped_unsubscribed' ? (
                        <Badge className="bg-slate-100 text-slate-600 flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          Skipped (Unsubscribed)
                        </Badge>
                      ) : (
                        <>
                          {recipient.sent && (
                            <Badge variant="default" className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Sent
                            </Badge>
                          )}
                          {recipient.opened_at && (
                            <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                              <Eye className="h-3 w-3" />
                              Opened{recipient.open_count > 1 ? ` (${recipient.open_count}x)` : ''}
                            </Badge>
                          )}
                          {recipient.unsubscribed_at && (
                            <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              Unsubscribed
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <EmailPreview
              subject={campaign?.email_templates?.subject || ''}
              body={campaign?.email_templates?.body || ''}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editTemplateOpen} onOpenChange={async (open) => {
        if (!open && !editTemplateActionRef.current && campaign?.email_templates?.id) {
          await autoSaveTemplate();
        }
        editTemplateActionRef.current = false;
        setEditTemplateOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-lg p-4">
              <label className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Modify with AI
              </label>
              <p className="text-xs text-blue-700 mb-3">
                Describe how you want to change the email (e.g., "make it more formal", "add a discount offer", "shorten the text")
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !generatingAi && handleAiModify()}
                  placeholder="e.g., Make the tone more friendly and add a 10% discount mention..."
                  className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  disabled={generatingAi}
                />
                <Button
                  onClick={handleAiModify}
                  disabled={generatingAi || !aiPrompt.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {generatingAi ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Apply
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Subject</label>
              <input
                type="text"
                value={editingSubject}
                onChange={(e) => setEditingSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Email Body</label>
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="mb-2">
                  <TabsTrigger value="editor">Visual Editor</TabsTrigger>
                  <TabsTrigger value="html" className="gap-1">
                    <Code className="h-3.5 w-3.5" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="editor">
                  <RichTextEditor
                    value={editingBody}
                    onChange={setEditingBody}
                    placeholder="Write your email content here..."
                    minHeight="350px"
                  />
                </TabsContent>
                <TabsContent value="html">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Image className="h-4 w-4" />
                        <span>Add images using HTML or upload directly</span>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={uploadingImage} asChild>
                          <span>
                            {uploadingImage ? (
                              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-1.5" />
                            )}
                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                          </span>
                        </Button>
                      </label>
                    </div>
                    <Textarea
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      placeholder="Enter your HTML content here..."
                      className="font-mono text-sm min-h-[350px] resize-y"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="preview">
                  <EmailPreview
                    subject={editingSubject}
                    body={editingBody}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              editTemplateActionRef.current = true;
              setEditTemplateOpen(false);
            }}>
              Discard Changes
            </Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
