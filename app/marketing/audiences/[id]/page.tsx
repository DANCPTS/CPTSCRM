'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, Building2, Users, Upload, Search, Trash2, Ban, FileSpreadsheet, Loader as Loader2, X, Plus, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, UsersRound } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AudienceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const audienceId = params.id as string;

  const [audience, setAudience] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('all');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSourceTab, setAddSourceTab] = useState('individuals');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingCrm, setLoadingCrm] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedAll, setSelectedAll] = useState<Set<string>>(new Set());
  const [excelRecipients, setExcelRecipients] = useState<any[]>([]);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [unsubscribedEmails, setUnsubscribedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAudienceData();
  }, [audienceId]);

  const loadAudienceData = async () => {
    try {
      const { data: audienceData, error } = await supabase
        .from('marketing_audiences')
        .select('*')
        .eq('id', audienceId)
        .maybeSingle();

      if (error) throw error;
      if (!audienceData) {
        toast.error('Audience not found');
        router.push('/marketing');
        return;
      }

      setAudience(audienceData);
      setNameValue(audienceData.name);
      setDescValue(audienceData.description || '');

      const { data: membersData } = await supabase
        .from('audience_members')
        .select('*')
        .eq('audience_id', audienceId)
        .order('added_at', { ascending: false });

      setMembers(membersData || []);
    } catch (error: any) {
      toast.error('Failed to load audience');
    } finally {
      setLoading(false);
    }
  };

  const loadCrmData = async () => {
    setLoadingCrm(true);
    try {
      const [candidatesRes, contactsRes, unsubRes] = await Promise.all([
        supabase.from('candidates').select('id, first_name, last_name, email').not('email', 'is', null).order('first_name'),
        supabase.from('contacts').select('id, first_name, last_name, email, companies(name)').not('email', 'is', null).order('first_name'),
        supabase.from('unsubscribed_emails').select('email'),
      ]);

      const existingEmails = new Set(members.map(m => m.email.toLowerCase()));

      const uniqueCandidates = new Map();
      (candidatesRes.data || []).forEach((c: any) => {
        if (c.email && !uniqueCandidates.has(c.email.toLowerCase()) && !existingEmails.has(c.email.toLowerCase())) {
          uniqueCandidates.set(c.email.toLowerCase(), {
            id: c.id, email: c.email.toLowerCase(),
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
          });
        }
      });
      setCandidates(Array.from(uniqueCandidates.values()));

      const uniqueContacts = new Map();
      (contactsRes.data || []).forEach((c: any) => {
        if (c.email && !uniqueContacts.has(c.email.toLowerCase()) && !existingEmails.has(c.email.toLowerCase())) {
          uniqueContacts.set(c.email.toLowerCase(), {
            id: c.id, email: c.email.toLowerCase(),
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
            company_name: c.companies?.name || null,
          });
        }
      });
      setContacts(Array.from(uniqueContacts.values()));
      setUnsubscribedEmails(new Set((unsubRes.data || []).map((d: any) => d.email.toLowerCase())));
    } catch (error: any) {
      toast.error('Failed to load CRM data');
    } finally {
      setLoadingCrm(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    try {
      await supabase.from('marketing_audiences').update({ name: nameValue.trim() }).eq('id', audienceId);
      setAudience((prev: any) => ({ ...prev, name: nameValue.trim() }));
      setEditingName(false);
      toast.success('Name updated');
    } catch { toast.error('Failed to update name'); }
  };

  const handleSaveDesc = async () => {
    try {
      await supabase.from('marketing_audiences').update({ description: descValue.trim() || null }).eq('id', audienceId);
      setAudience((prev: any) => ({ ...prev, description: descValue.trim() || null }));
      setEditingDesc(false);
      toast.success('Description updated');
    } catch { toast.error('Failed to update description'); }
  };

  const handleRemoveSelected = async () => {
    if (selectedMembers.size === 0) return;
    try {
      const ids = Array.from(selectedMembers);
      const { error } = await supabase.from('audience_members').delete().in('id', ids);
      if (error) throw error;
      await supabase.from('marketing_audiences').update({ member_count: members.length - ids.length }).eq('id', audienceId);
      toast.success(`Removed ${ids.length} members`);
      setSelectedMembers(new Set());
      loadAudienceData();
    } catch { toast.error('Failed to remove members'); }
  };

  const handleUnsubscribeSelected = async () => {
    if (selectedMembers.size === 0) return;
    try {
      const ids = Array.from(selectedMembers);
      const selectedMemberData = members.filter(m => ids.includes(m.id));

      await supabase.from('audience_members')
        .update({ subscribed: false, unsubscribed_at: new Date().toISOString() })
        .in('id', ids);

      for (const m of selectedMemberData) {
        await supabase.from('unsubscribed_emails').upsert({
          email: m.email.toLowerCase(),
          reason: 'manual_admin',
          unsubscribed_at: new Date().toISOString(),
        }, { onConflict: 'email' });
      }

      toast.success(`Unsubscribed ${ids.length} members`);
      setSelectedMembers(new Set());
      loadAudienceData();
    } catch { toast.error('Failed to unsubscribe members'); }
  };

  const handleResubscribe = async (memberId: string, email: string) => {
    try {
      await supabase.from('audience_members')
        .update({ subscribed: true, unsubscribed_at: null })
        .eq('id', memberId);
      await supabase.from('unsubscribed_emails').delete().eq('email', email.toLowerCase());
      toast.success('Member resubscribed');
      loadAudienceData();
    } catch { toast.error('Failed to resubscribe'); }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExt)) { toast.error('Please select an Excel or CSV file'); return; }

    setUploadingExcel(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });
      if (jsonData.length < 2) { toast.error('File needs a header and data rows'); return; }

      const headerRow = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());
      const emailIndex = headerRow.findIndex(h => h.includes('email'));
      const nameIndex = headerRow.findIndex(h => h.includes('name') && !h.includes('company') && !h.includes('first') && !h.includes('last'));
      const firstNameIndex = headerRow.findIndex(h => h === 'first name' || h === 'firstname' || h === 'first_name' || h === 'first');
      const lastNameIndex = headerRow.findIndex(h => h === 'last name' || h === 'lastname' || h === 'last_name' || h === 'last' || h === 'surname');
      const companyIndex = headerRow.findIndex(h => h.includes('company') || h.includes('business'));
      if (emailIndex === -1) { toast.error('File must have an Email column'); return; }

      const existingEmails = new Set([...members.map(m => m.email.toLowerCase()), ...excelRecipients.map(r => r.email)]);
      const parsed: any[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;
        const email = String(row[emailIndex] || '').trim().toLowerCase();
        if (email && email.includes('@') && !existingEmails.has(email)) {
          let recipientName = '';
          if (firstNameIndex !== -1 || lastNameIndex !== -1) {
            recipientName = `${firstNameIndex !== -1 ? String(row[firstNameIndex] || '').trim() : ''} ${lastNameIndex !== -1 ? String(row[lastNameIndex] || '').trim() : ''}`.trim();
          } else if (nameIndex !== -1) { recipientName = String(row[nameIndex] || '').trim(); }
          parsed.push({ email, name: recipientName || email.split('@')[0], company_name: companyIndex !== -1 ? String(row[companyIndex] || '').trim() || undefined : undefined, source: 'excel_upload' });
          existingEmails.add(email);
        }
      }
      if (parsed.length === 0) { toast.error('No valid new emails found'); return; }
      setExcelRecipients(prev => [...prev, ...parsed]);
      toast.success(`Found ${parsed.length} contacts`);
    } catch (error: any) { toast.error('Failed to parse file'); }
    finally { setUploadingExcel(false); e.target.value = ''; }
  };

  const handleAddMembers = async () => {
    setAdding(true);
    try {
      const newMembers: any[] = [];
      const seenEmails = new Set<string>();

      selectedCandidates.forEach(email => {
        if (!seenEmails.has(email)) {
          const c = candidates.find(x => x.email === email);
          if (c) { newMembers.push({ audience_id: audienceId, email: c.email, name: c.name, source: 'candidate', source_id: c.id, subscribed: !unsubscribedEmails.has(c.email), unsubscribed_at: unsubscribedEmails.has(c.email) ? new Date().toISOString() : null }); seenEmails.add(email); }
        }
      });
      selectedContacts.forEach(email => {
        if (!seenEmails.has(email)) {
          const c = contacts.find(x => x.email === email);
          if (c) { newMembers.push({ audience_id: audienceId, email: c.email, name: c.name, company_name: c.company_name, source: 'contact', source_id: c.id, subscribed: !unsubscribedEmails.has(c.email), unsubscribed_at: unsubscribedEmails.has(c.email) ? new Date().toISOString() : null }); seenEmails.add(email); }
        }
      });
      selectedAll.forEach(email => {
        if (!seenEmails.has(email)) {
          const candidate = candidates.find(x => x.email === email);
          const contact = contacts.find(x => x.email === email);
          if (candidate) { newMembers.push({ audience_id: audienceId, email: candidate.email, name: candidate.name, source: 'candidate', source_id: candidate.id, subscribed: !unsubscribedEmails.has(candidate.email), unsubscribed_at: unsubscribedEmails.has(candidate.email) ? new Date().toISOString() : null }); }
          else if (contact) { newMembers.push({ audience_id: audienceId, email: contact.email, name: contact.name, company_name: contact.company_name, source: 'contact', source_id: contact.id, subscribed: !unsubscribedEmails.has(contact.email), unsubscribed_at: unsubscribedEmails.has(contact.email) ? new Date().toISOString() : null }); }
          seenEmails.add(email);
        }
      });
      excelRecipients.forEach(r => {
        if (!seenEmails.has(r.email)) {
          newMembers.push({ audience_id: audienceId, email: r.email, name: r.name, company_name: r.company_name || null, source: 'excel_upload', subscribed: !unsubscribedEmails.has(r.email), unsubscribed_at: unsubscribedEmails.has(r.email) ? new Date().toISOString() : null });
          seenEmails.add(r.email);
        }
      });

      if (newMembers.length === 0) { toast.error('No new members to add'); setAdding(false); return; }

      const BATCH_SIZE = 500;
      for (let i = 0; i < newMembers.length; i += BATCH_SIZE) {
        const { error } = await supabase.from('audience_members').insert(newMembers.slice(i, i + BATCH_SIZE));
        if (error) throw error;
      }

      await supabase.from('marketing_audiences').update({ member_count: members.length + newMembers.length }).eq('id', audienceId);

      toast.success(`Added ${newMembers.length} members`);
      setAddDialogOpen(false);
      resetAddForm();
      loadAudienceData();
    } catch (error: any) { toast.error('Failed to add members: ' + error.message); }
    finally { setAdding(false); }
  };

  const resetAddForm = () => {
    setSelectedCandidates(new Set());
    setSelectedContacts(new Set());
    setSelectedAll(new Set());
    setExcelRecipients([]);
    setAddSearch('');
    setAddSourceTab('individuals');
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()) || (m.company_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && m.subscribed) || (statusFilter === 'unsubscribed' && !m.subscribed);
    return matchesSearch && matchesStatus;
  });

  const activeCount = members.filter(m => m.subscribed).length;
  const unsubCount = members.filter(m => !m.subscribed).length;

  const toggleSet = (set: Set<string>, setFn: (s: Set<string>) => void, email: string) => {
    const next = new Set(set);
    if (next.has(email)) next.delete(email); else next.add(email);
    setFn(next);
  };

  const allCrmContacts = [
    ...candidates.map(c => ({ ...c, _source: 'candidate' as const })),
    ...contacts.filter(c => !candidates.some(cand => cand.email === c.email)).map(c => ({ ...c, _source: 'contact' as const })),
  ];

  const filteredAddCandidates = candidates.filter(c => c.name.toLowerCase().includes(addSearch.toLowerCase()) || c.email.toLowerCase().includes(addSearch.toLowerCase()));
  const filteredAddContacts = contacts.filter(c => c.name.toLowerCase().includes(addSearch.toLowerCase()) || c.email.toLowerCase().includes(addSearch.toLowerCase()) || (c.company_name || '').toLowerCase().includes(addSearch.toLowerCase()));
  const filteredAddAll = allCrmContacts.filter(c => c.name.toLowerCase().includes(addSearch.toLowerCase()) || c.email.toLowerCase().includes(addSearch.toLowerCase()) || (c.company_name || '').toLowerCase().includes(addSearch.toLowerCase()));

  const totalNewToAdd = new Set([...Array.from(selectedCandidates), ...Array.from(selectedContacts), ...Array.from(selectedAll), ...excelRecipients.map(r => r.email)]).size;

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading audience...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!audience) {
    return (
      <AppShell>
        <div className="p-8">
          <Card><CardContent className="py-12 text-center"><p className="text-lg text-gray-600">Audience not found</p><Button onClick={() => router.push('/marketing')} className="mt-4">Back to Marketing</Button></CardContent></Card>
        </div>
      </AppShell>
    );
  }

  const getTypeLabel = (t: string) => {
    switch (t) { case 'individuals': return 'Individuals'; case 'companies': return 'Companies'; case 'all': return 'All Contacts'; case 'upload_only': return 'Upload'; default: return t; }
  };

  return (
    <AppShell>
      <div className="p-8">
        <Button variant="ghost" onClick={() => router.push('/marketing')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketing
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2 mb-2">
                <Input value={nameValue} onChange={e => setNameValue(e.target.value)} className="text-2xl font-bold h-auto py-1 max-w-md" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
                <Button size="sm" onClick={handleSaveName}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameValue(audience.name); }}>Cancel</Button>
              </div>
            ) : (
              <h1 className="text-3xl font-bold text-slate-900 cursor-pointer hover:text-slate-700" onClick={() => setEditingName(true)}>{audience.name}</h1>
            )}
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="flex items-center gap-1">
                {audience.audience_type === 'individuals' ? <User className="h-3 w-3" /> : audience.audience_type === 'companies' ? <Building2 className="h-3 w-3" /> : audience.audience_type === 'all' ? <Users className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                {getTypeLabel(audience.audience_type)}
              </Badge>
              {editingDesc ? (
                <div className="flex items-center gap-2">
                  <Input value={descValue} onChange={e => setDescValue(e.target.value)} placeholder="Add description..." className="text-sm max-w-sm" onKeyDown={e => e.key === 'Enter' && handleSaveDesc()} />
                  <Button size="sm" variant="outline" onClick={handleSaveDesc}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingDesc(false); setDescValue(audience.description || ''); }}>Cancel</Button>
                </div>
              ) : (
                <span className="text-sm text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => setEditingDesc(true)}>
                  {audience.description || 'Click to add description'}
                </span>
              )}
            </div>
          </div>
          <Button onClick={() => { setAddDialogOpen(true); loadCrmData(); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Members
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-slate-900">{members.length}</div>
              <div className="text-sm text-slate-500">Total Members</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{activeCount}</div>
              <div className="text-sm text-slate-500">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{unsubCount}</div>
              <div className="text-sm text-slate-500">Unsubscribed</div>
            </CardContent>
          </Card>
        </div>

        {unsubCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {unsubCount} member{unsubCount !== 1 ? 's are' : ' is'} globally unsubscribed and will be excluded from campaign sends.
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({members.length})</SelectItem>
                    <SelectItem value="active">Active ({activeCount})</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed ({unsubCount})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedMembers.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedMembers.size} selected</Badge>
                  <Button variant="outline" size="sm" onClick={handleUnsubscribeSelected}>
                    <Ban className="h-4 w-4 mr-1" /> Unsubscribe
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleRemoveSelected}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <UsersRound className="h-12 w-12 mx-auto mb-3" />
                <p>No members match your search</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {filteredMembers.map(member => (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${!member.subscribed ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                  >
                    <Checkbox
                      checked={selectedMembers.has(member.id)}
                      onCheckedChange={() => {
                        const next = new Set(selectedMembers);
                        if (next.has(member.id)) next.delete(member.id); else next.add(member.id);
                        setSelectedMembers(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      {member.company_name && (
                        <p className="text-xs text-slate-400 flex items-center gap-1"><Building2 className="h-3 w-3" />{member.company_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {member.source === 'candidate' ? 'Candidate' : member.source === 'contact' ? 'Contact' : 'Upload'}
                      </Badge>
                      {member.subscribed ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" /> Active
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Badge className="bg-red-100 text-red-700 text-xs">
                            <Ban className="h-3 w-3 mr-1" /> Unsubscribed
                          </Badge>
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => handleResubscribe(member.id, member.email)}>
                            Resubscribe
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={v => { if (!v) resetAddForm(); setAddDialogOpen(v); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Members to {audience.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            <Tabs value={addSourceTab} onValueChange={setAddSourceTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="individuals" className="text-xs gap-1"><User className="h-3.5 w-3.5" /> Individuals</TabsTrigger>
                <TabsTrigger value="companies" className="text-xs gap-1"><Building2 className="h-3.5 w-3.5" /> Companies</TabsTrigger>
                <TabsTrigger value="all" className="text-xs gap-1"><Users className="h-3.5 w-3.5" /> All Contacts</TabsTrigger>
                <TabsTrigger value="upload" className="text-xs gap-1"><Upload className="h-3.5 w-3.5" /> Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="individuals" className="space-y-3 mt-3">
                {loadingCrm ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="pl-9" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { if (selectedCandidates.size === filteredAddCandidates.length) setSelectedCandidates(new Set()); else setSelectedCandidates(new Set(filteredAddCandidates.map(c => c.email))); }}>
                        {selectedCandidates.size === filteredAddCandidates.length && filteredAddCandidates.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Badge variant="outline">{selectedCandidates.size}</Badge>
                    </div>
                    <ScrollArea className="h-[280px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {filteredAddCandidates.map(c => (
                          <div key={c.email} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer" onClick={() => toggleSet(selectedCandidates, setSelectedCandidates, c.email)}>
                            <Checkbox checked={selectedCandidates.has(c.email)} />
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-slate-500 truncate">{c.email}</p></div>
                            {unsubscribedEmails.has(c.email) && <Badge variant="outline" className="text-red-600 border-red-200 text-xs">Unsubscribed</Badge>}
                          </div>
                        ))}
                        {filteredAddCandidates.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No new candidates to add</p>}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="companies" className="space-y-3 mt-3">
                {loadingCrm ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="pl-9" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { if (selectedContacts.size === filteredAddContacts.length) setSelectedContacts(new Set()); else setSelectedContacts(new Set(filteredAddContacts.map(c => c.email))); }}>
                        {selectedContacts.size === filteredAddContacts.length && filteredAddContacts.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Badge variant="outline">{selectedContacts.size}</Badge>
                    </div>
                    <ScrollArea className="h-[280px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {filteredAddContacts.map(c => (
                          <div key={c.email} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer" onClick={() => toggleSet(selectedContacts, setSelectedContacts, c.email)}>
                            <Checkbox checked={selectedContacts.has(c.email)} />
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-slate-500 truncate">{c.email}</p>{c.company_name && <p className="text-xs text-slate-400">{c.company_name}</p>}</div>
                            {unsubscribedEmails.has(c.email) && <Badge variant="outline" className="text-red-600 border-red-200 text-xs">Unsubscribed</Badge>}
                          </div>
                        ))}
                        {filteredAddContacts.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No new contacts to add</p>}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="all" className="space-y-3 mt-3">
                {loadingCrm ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search..." value={addSearch} onChange={e => setAddSearch(e.target.value)} className="pl-9" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { if (selectedAll.size === filteredAddAll.length) setSelectedAll(new Set()); else setSelectedAll(new Set(filteredAddAll.map(c => c.email))); }}>
                        {selectedAll.size === filteredAddAll.length && filteredAddAll.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Badge variant="outline">{selectedAll.size}</Badge>
                    </div>
                    <ScrollArea className="h-[280px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {filteredAddAll.map(c => (
                          <div key={c.email} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer" onClick={() => toggleSet(selectedAll, setSelectedAll, c.email)}>
                            <Checkbox checked={selectedAll.has(c.email)} />
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-slate-500 truncate">{c.email}</p></div>
                            <Badge variant="outline" className="text-xs">{c._source === 'candidate' ? 'Candidate' : 'Contact'}</Badge>
                            {unsubscribedEmails.has(c.email) && <Badge variant="outline" className="text-red-600 border-red-200 text-xs">Unsubscribed</Badge>}
                          </div>
                        ))}
                        {filteredAddAll.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No new contacts to add</p>}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="upload" className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Upload CSV or Excel file</p>
                  <label className="cursor-pointer">
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleExcelUpload} className="hidden" disabled={uploadingExcel} />
                    <Button variant="outline" size="sm" disabled={uploadingExcel} asChild>
                      <span>{uploadingExcel ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}{uploadingExcel ? 'Processing...' : 'Upload File'}</span>
                    </Button>
                  </label>
                </div>
                {excelRecipients.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-green-700">{excelRecipients.length} contacts</p>
                      <Button variant="ghost" size="sm" onClick={() => setExcelRecipients([])}><X className="h-4 w-4 mr-1" /> Clear</Button>
                    </div>
                    <ScrollArea className="h-[240px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {excelRecipients.map(r => (
                          <div key={r.email} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                            <div className="min-w-0"><p className="font-medium truncate">{r.name}</p><p className="text-xs text-slate-500 truncate">{r.email}</p></div>
                            <Button variant="ghost" size="sm" onClick={() => setExcelRecipients(prev => prev.filter(x => x.email !== r.email))}><X className="h-4 w-4 text-slate-400" /></Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                    <FileSpreadsheet className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No file uploaded yet</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {totalNewToAdd > 0 && (
              <div className="bg-slate-50 border rounded-lg p-3 text-sm font-medium text-slate-700">
                {totalNewToAdd} new member{totalNewToAdd !== 1 ? 's' : ''} to add
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => { resetAddForm(); setAddDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleAddMembers} disabled={adding || totalNewToAdd === 0}>
              {adding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : `Add Members (${totalNewToAdd})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
