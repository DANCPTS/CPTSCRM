'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Building2, Users, Upload, FileSpreadsheet, Search, Loader as Loader2, X, TriangleAlert as AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Recipient {
  email: string;
  name: string;
  company_name?: string;
  source: 'candidate' | 'contact' | 'excel_upload';
  source_id?: string;
}

interface AudienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AudienceDialog({ open, onOpenChange, onCreated }: AudienceDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [sourceTab, setSourceTab] = useState('individuals');

  const [candidates, setCandidates] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingCrm, setLoadingCrm] = useState(false);

  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedAll, setSelectedAll] = useState<Set<string>>(new Set());
  const [excelRecipients, setExcelRecipients] = useState<Recipient[]>([]);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  const [candidateSearch, setCandidateSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [allSearch, setAllSearch] = useState('');

  const [unsubscribedEmails, setUnsubscribedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadCrmData();
      loadUnsubscribed();
    }
  }, [open]);

  const loadCrmData = async () => {
    setLoadingCrm(true);
    try {
      const [candidatesRes, contactsRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, first_name, last_name, email')
          .not('email', 'is', null)
          .order('first_name'),
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, companies(name)')
          .not('email', 'is', null)
          .order('first_name'),
      ]);

      const uniqueCandidates = new Map();
      (candidatesRes.data || []).forEach((c: any) => {
        if (c.email && !uniqueCandidates.has(c.email.toLowerCase())) {
          uniqueCandidates.set(c.email.toLowerCase(), {
            id: c.id,
            email: c.email.toLowerCase(),
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
          });
        }
      });
      setCandidates(Array.from(uniqueCandidates.values()));

      const uniqueContacts = new Map();
      (contactsRes.data || []).forEach((c: any) => {
        if (c.email && !uniqueContacts.has(c.email.toLowerCase())) {
          uniqueContacts.set(c.email.toLowerCase(), {
            id: c.id,
            email: c.email.toLowerCase(),
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
            company_name: c.companies?.name || null,
          });
        }
      });
      setContacts(Array.from(uniqueContacts.values()));
    } catch (error: any) {
      toast.error('Failed to load CRM data');
    } finally {
      setLoadingCrm(false);
    }
  };

  const loadUnsubscribed = async () => {
    const { data } = await supabase.from('unsubscribed_emails').select('email');
    setUnsubscribedEmails(new Set((data || []).map((d: any) => d.email.toLowerCase())));
  };

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

      const existingEmails = new Set(excelRecipients.map(r => r.email));
      const parsed: Recipient[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;
        const email = String(row[emailIndex] || '').trim().toLowerCase();
        if (email && email.includes('@') && !existingEmails.has(email)) {
          let recipientName = '';
          if (firstNameIndex !== -1 || lastNameIndex !== -1) {
            const firstName = firstNameIndex !== -1 ? String(row[firstNameIndex] || '').trim() : '';
            const lastName = lastNameIndex !== -1 ? String(row[lastNameIndex] || '').trim() : '';
            recipientName = `${firstName} ${lastName}`.trim();
          } else if (nameIndex !== -1) {
            recipientName = String(row[nameIndex] || '').trim();
          }
          const companyName = companyIndex !== -1 ? String(row[companyIndex] || '').trim() : undefined;
          parsed.push({
            email,
            name: recipientName || email.split('@')[0],
            company_name: companyName || undefined,
            source: 'excel_upload',
          });
          existingEmails.add(email);
        }
      }

      if (parsed.length === 0) {
        toast.error('No valid new email addresses found in the file');
        return;
      }

      setExcelRecipients(prev => [...prev, ...parsed]);
      toast.success(`Found ${parsed.length} valid contacts`);
    } catch (error: any) {
      toast.error('Failed to parse file: ' + error.message);
    } finally {
      setUploadingExcel(false);
      e.target.value = '';
    }
  };

  const getAllSelected = (): Recipient[] => {
    const result: Recipient[] = [];
    const seenEmails = new Set<string>();

    selectedCandidates.forEach(email => {
      if (!seenEmails.has(email)) {
        const c = candidates.find(x => x.email === email);
        if (c) {
          result.push({ email: c.email, name: c.name, source: 'candidate', source_id: c.id });
          seenEmails.add(email);
        }
      }
    });

    selectedContacts.forEach(email => {
      if (!seenEmails.has(email)) {
        const c = contacts.find(x => x.email === email);
        if (c) {
          result.push({ email: c.email, name: c.name, company_name: c.company_name, source: 'contact', source_id: c.id });
          seenEmails.add(email);
        }
      }
    });

    selectedAll.forEach(email => {
      if (!seenEmails.has(email)) {
        const candidate = candidates.find(x => x.email === email);
        const contact = contacts.find(x => x.email === email);
        if (candidate) {
          result.push({ email: candidate.email, name: candidate.name, source: 'candidate', source_id: candidate.id });
        } else if (contact) {
          result.push({ email: contact.email, name: contact.name, company_name: contact.company_name, source: 'contact', source_id: contact.id });
        }
        seenEmails.add(email);
      }
    });

    excelRecipients.forEach(r => {
      if (!seenEmails.has(r.email)) {
        result.push(r);
        seenEmails.add(r.email);
      }
    });

    return result;
  };

  const totalSelected = getAllSelected();
  const unsubscribedCount = totalSelected.filter(r => unsubscribedEmails.has(r.email)).length;

  const determineType = (): string => {
    const hasCandidates = selectedCandidates.size > 0;
    const hasContacts = selectedContacts.size > 0;
    const hasAll = selectedAll.size > 0;
    const hasExcel = excelRecipients.length > 0;

    if (hasAll || (hasCandidates && hasContacts)) return 'all';
    if (hasCandidates && !hasContacts && !hasExcel) return 'individuals';
    if (hasContacts && !hasCandidates && !hasExcel) return 'companies';
    if (hasExcel && !hasCandidates && !hasContacts && !hasAll) return 'upload_only';
    if (hasCandidates) return 'individuals';
    if (hasContacts) return 'companies';
    return 'upload_only';
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter an audience name');
      return;
    }
    if (totalSelected.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: audience, error } = await supabase
        .from('marketing_audiences')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          audience_type: determineType(),
          member_count: totalSelected.length,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const members = totalSelected.map(r => ({
        audience_id: audience.id,
        email: r.email,
        name: r.name,
        company_name: r.company_name || null,
        source: r.source,
        source_id: r.source_id || null,
        subscribed: !unsubscribedEmails.has(r.email),
        unsubscribed_at: unsubscribedEmails.has(r.email) ? new Date().toISOString() : null,
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < members.length; i += BATCH_SIZE) {
        const batch = members.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('audience_members').insert(batch);
        if (insertError) throw insertError;
      }

      toast.success(`Audience "${name}" created with ${totalSelected.length} members`);
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (error: any) {
      toast.error('Failed to create audience: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedCandidates(new Set());
    setSelectedContacts(new Set());
    setSelectedAll(new Set());
    setExcelRecipients([]);
    setCandidateSearch('');
    setContactSearch('');
    setAllSearch('');
    setSourceTab('individuals');
  };

  const filteredCandidates = candidates.filter(c =>
    c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(candidateSearch.toLowerCase())
  );

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.company_name || '').toLowerCase().includes(contactSearch.toLowerCase())
  );

  const allCrmContacts = [
    ...candidates.map(c => ({ ...c, _source: 'candidate' as const })),
    ...contacts.filter(c => !candidates.some(cand => cand.email === c.email)).map(c => ({ ...c, _source: 'contact' as const })),
  ];

  const filteredAll = allCrmContacts.filter(c =>
    c.name.toLowerCase().includes(allSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(allSearch.toLowerCase()) ||
    (c.company_name || '').toLowerCase().includes(allSearch.toLowerCase())
  );

  const toggleSet = (set: Set<string>, setFn: (s: Set<string>) => void, email: string) => {
    const next = new Set(set);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setFn(next);
  };

  const selectAllInSet = (items: any[], set: Set<string>, setFn: (s: Set<string>) => void) => {
    if (set.size === items.length) setFn(new Set());
    else setFn(new Set(items.map(i => i.email)));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Audience</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Audience Name</Label>
              <Input placeholder="e.g., Q1 2026 Prospects" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input placeholder="e.g., All construction companies in London" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Add Members</Label>
            <Tabs value={sourceTab} onValueChange={setSourceTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="individuals" className="text-xs gap-1">
                  <User className="h-3.5 w-3.5" />
                  Individuals
                </TabsTrigger>
                <TabsTrigger value="companies" className="text-xs gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Companies
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs gap-1">
                  <Users className="h-3.5 w-3.5" />
                  All Contacts
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-xs gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </TabsTrigger>
              </TabsList>

              <TabsContent value="individuals" className="space-y-3 mt-3">
                {loadingCrm ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search candidates..." value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} className="pl-9" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => selectAllInSet(filteredCandidates, selectedCandidates, setSelectedCandidates)}>
                        {selectedCandidates.size === filteredCandidates.length && filteredCandidates.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Badge variant="outline">{selectedCandidates.size} selected</Badge>
                    </div>
                    <ScrollArea className="h-[280px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {filteredCandidates.map(c => (
                          <div key={c.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => toggleSet(selectedCandidates, setSelectedCandidates, c.email)}>
                            <Checkbox checked={selectedCandidates.has(c.email)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-slate-500 truncate">{c.email}</p>
                            </div>
                            {unsubscribedEmails.has(c.email) && <Badge variant="outline" className="text-red-600 border-red-200 text-xs">Unsubscribed</Badge>}
                          </div>
                        ))}
                        {filteredCandidates.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No candidates found</p>}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="companies" className="space-y-3 mt-3">
                {loadingCrm ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search contacts..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="pl-9" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => selectAllInSet(filteredContacts, selectedContacts, setSelectedContacts)}>
                        {selectedContacts.size === filteredContacts.length && filteredContacts.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Badge variant="outline">{selectedContacts.size} selected</Badge>
                    </div>
                    <ScrollArea className="h-[280px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {filteredContacts.map(c => (
                          <div key={c.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => toggleSet(selectedContacts, setSelectedContacts, c.email)}>
                            <Checkbox checked={selectedContacts.has(c.email)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-slate-500 truncate">{c.email}</p>
                              {c.company_name && <p className="text-xs text-slate-400 flex items-center gap-1"><Building2 className="h-3 w-3" />{c.company_name}</p>}
                            </div>
                            {unsubscribedEmails.has(c.email) && <Badge variant="outline" className="text-red-600 border-red-200 text-xs">Unsubscribed</Badge>}
                          </div>
                        ))}
                        {filteredContacts.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No contacts found</p>}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="all" className="space-y-3 mt-3">
                {loadingCrm ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search all contacts..." value={allSearch} onChange={e => setAllSearch(e.target.value)} className="pl-9" />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => selectAllInSet(filteredAll, selectedAll, setSelectedAll)}>
                        {selectedAll.size === filteredAll.length && filteredAll.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Badge variant="outline">{selectedAll.size} selected</Badge>
                    </div>
                    <ScrollArea className="h-[280px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {filteredAll.map(c => (
                          <div key={c.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => toggleSet(selectedAll, setSelectedAll, c.email)}>
                            <Checkbox checked={selectedAll.has(c.email)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-slate-500 truncate">{c.email}</p>
                              {c.company_name && <p className="text-xs text-slate-400 flex items-center gap-1"><Building2 className="h-3 w-3" />{c.company_name}</p>}
                            </div>
                            <Badge variant="outline" className="text-xs">{c._source === 'candidate' ? 'Candidate' : 'Contact'}</Badge>
                            {unsubscribedEmails.has(c.email) && <Badge variant="outline" className="text-red-600 border-red-200 text-xs">Unsubscribed</Badge>}
                          </div>
                        ))}
                        {filteredAll.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No contacts found</p>}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </TabsContent>

              <TabsContent value="upload" className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Upload a CSV or Excel file with columns: <strong>Email</strong> (required), <strong>Name</strong>, <strong>Company</strong> (optional).
                  </p>
                  <label className="cursor-pointer">
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleExcelUpload} className="hidden" disabled={uploadingExcel} />
                    <Button variant="outline" size="sm" disabled={uploadingExcel} asChild>
                      <span>
                        {uploadingExcel ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                        {uploadingExcel ? 'Processing...' : 'Upload File'}
                      </span>
                    </Button>
                  </label>
                </div>
                {excelRecipients.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-green-700">{excelRecipients.length} contacts from upload</p>
                      <Button variant="ghost" size="sm" onClick={() => setExcelRecipients([])}>
                        <X className="h-4 w-4 mr-1" /> Clear
                      </Button>
                    </div>
                    <ScrollArea className="h-[240px] border rounded-lg">
                      <div className="p-2 space-y-1">
                        {excelRecipients.map(r => (
                          <div key={r.email} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileSpreadsheet className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{r.name}</p>
                                <p className="text-xs text-slate-500 truncate">{r.email}</p>
                              </div>
                            </div>
                            {unsubscribedEmails.has(r.email) && <Badge variant="outline" className="text-red-600 border-red-200 text-xs mr-2">Unsubscribed</Badge>}
                            <Button variant="ghost" size="sm" onClick={() => setExcelRecipients(prev => prev.filter(x => x.email !== r.email))}>
                              <X className="h-4 w-4 text-slate-400" />
                            </Button>
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
          </div>

          {totalSelected.length > 0 && (
            <div className="bg-slate-50 border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium text-slate-700">{totalSelected.length} total members</span>
                {unsubscribedCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {unsubscribedCount} globally unsubscribed (will be marked inactive)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || totalSelected.length === 0 || !name.trim()}>
            {creating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
            ) : (
              `Create Audience (${totalSelected.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
