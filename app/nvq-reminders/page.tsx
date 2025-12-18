'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Award, Phone, Mail, Clock, AlertCircle, Search, Filter, Calendar, User, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, parseISO, isPast, isToday, addDays, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';

interface NvqTrackingWithCandidate {
  id: string;
  candidate_id: string;
  source_candidate_course_id?: string;
  accreditation_type: string;
  requires_nvq: boolean;
  red_card_expiry_date?: string;
  nvq_status: string;
  nvq_reminder_date: string;
  last_contacted_date?: string;
  notes?: string;
  created_at: string;
  candidates: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  };
  source_course?: {
    courses?: {
      title: string;
    };
    course_runs?: {
      end_date: string;
    };
  };
}

export default function NvqRemindersPage() {
  const [nvqRecords, setNvqRecords] = useState<NvqTrackingWithCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all_active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<NvqTrackingWithCandidate | null>(null);
  const [contactForm, setContactForm] = useState({
    contact_method: 'phone',
    outcome: 'reached',
    notes: '',
    follow_up_date: '',
  });

  useEffect(() => {
    loadNvqRecords();
  }, [filter]);

  const loadNvqRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('nvq_tracking')
        .select(`
          *,
          candidates!candidate_id(id, first_name, last_name, email, phone),
          source_course:candidate_courses!source_candidate_course_id(
            courses!course_id(title),
            course_runs!course_run_id(end_date)
          )
        `)
        .order('nvq_reminder_date', { ascending: true });

      if (filter === 'overdue') {
        query = query
          .lt('nvq_reminder_date', format(new Date(), 'yyyy-MM-dd'))
          .not('nvq_status', 'in', '("completed","declined","not_required")');
      } else if (filter === 'today') {
        query = query
          .eq('nvq_reminder_date', format(new Date(), 'yyyy-MM-dd'))
          .not('nvq_status', 'in', '("completed","declined","not_required")');
      } else if (filter === 'this_week') {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
        query = query
          .gte('nvq_reminder_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('nvq_reminder_date', format(weekEnd, 'yyyy-MM-dd'))
          .not('nvq_status', 'in', '("completed","declined","not_required")');
      } else if (filter === 'this_month') {
        const monthEnd = addDays(new Date(), 30);
        query = query
          .lte('nvq_reminder_date', format(monthEnd, 'yyyy-MM-dd'))
          .not('nvq_status', 'in', '("completed","declined","not_required")');
      } else if (filter === 'all_active') {
        query = query.not('nvq_status', 'in', '("completed","declined","not_required")');
      } else if (filter === 'completed') {
        query = query.eq('nvq_status', 'completed');
      } else if (filter === 'declined') {
        query = query.eq('nvq_status', 'declined');
      }

      const { data, error } = await query;

      if (error) throw error;
      setNvqRecords(data || []);
    } catch (error: any) {
      console.error('Failed to load NVQ records:', error);
      toast.error('Failed to load NVQ records');
    } finally {
      setLoading(false);
    }
  };

  const getNvqStatusColor = (status: string) => {
    switch (status) {
      case 'eligible':
        return 'bg-blue-100 text-blue-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'interested':
        return 'bg-orange-100 text-orange-800';
      case 'in_progress':
        return 'bg-cyan-100 text-cyan-800';
      case 'enrolled':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'not_required':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRowColor = (record: NvqTrackingWithCandidate) => {
    const reminderDate = parseISO(record.nvq_reminder_date);
    if (isPast(reminderDate) && !isToday(reminderDate)) {
      return 'bg-red-50 hover:bg-red-100';
    }
    if (isToday(reminderDate)) {
      return 'bg-amber-50 hover:bg-amber-100';
    }
    return 'hover:bg-slate-50';
  };

  const filteredRecords = nvqRecords.filter(record => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const candidateName = `${record.candidates?.first_name} ${record.candidates?.last_name}`.toLowerCase();
    const courseName = record.source_course?.courses?.title?.toLowerCase() || '';
    const email = record.candidates?.email?.toLowerCase() || '';
    const phone = record.candidates?.phone || '';
    return candidateName.includes(search) || courseName.includes(search) || email.includes(search) || phone.includes(search);
  });

  const overdueCount = nvqRecords.filter(r => {
    const reminderDate = parseISO(r.nvq_reminder_date);
    return isPast(reminderDate) && !isToday(reminderDate);
  }).length;

  const todayCount = nvqRecords.filter(r => isToday(parseISO(r.nvq_reminder_date))).length;

  const handleUpdateStatus = async (recordId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('nvq_tracking')
        .update({ nvq_status: newStatus })
        .eq('id', recordId);

      if (error) throw error;

      toast.success('Status updated');
      loadNvqRecords();
    } catch (error: any) {
      toast.error('Failed to update status');
    }
  };

  const handleSnooze = async (recordId: string, days: number) => {
    try {
      const newDate = addDays(new Date(), days);

      const { error } = await supabase
        .from('nvq_tracking')
        .update({ nvq_reminder_date: format(newDate, 'yyyy-MM-dd') })
        .eq('id', recordId);

      if (error) throw error;

      toast.success(`Reminder snoozed for ${days} days`);
      loadNvqRecords();
    } catch (error: any) {
      toast.error('Failed to snooze reminder');
    }
  };

  const handleBulkSnooze = async (days: number) => {
    if (selectedRecords.length === 0) {
      toast.error('No records selected');
      return;
    }

    try {
      const newDate = format(addDays(new Date(), days), 'yyyy-MM-dd');

      const { error } = await supabase
        .from('nvq_tracking')
        .update({ nvq_reminder_date: newDate })
        .in('id', selectedRecords);

      if (error) throw error;

      toast.success(`${selectedRecords.length} reminders snoozed for ${days} days`);
      setSelectedRecords([]);
      loadNvqRecords();
    } catch (error: any) {
      toast.error('Failed to snooze reminders');
    }
  };

  const handleBulkMarkContacted = async () => {
    if (selectedRecords.length === 0) {
      toast.error('No records selected');
      return;
    }

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { error } = await supabase
        .from('nvq_tracking')
        .update({
          nvq_status: 'contacted',
          last_contacted_date: today,
        })
        .in('id', selectedRecords)
        .eq('nvq_status', 'eligible');

      if (error) throw error;

      toast.success(`${selectedRecords.length} records marked as contacted`);
      setSelectedRecords([]);
      loadNvqRecords();
    } catch (error: any) {
      toast.error('Failed to update records');
    }
  };

  const handleLogContact = async () => {
    if (!selectedRecord) return;

    try {
      const { data: authData } = await supabase.auth.getUser();

      const { error: logError } = await supabase
        .from('nvq_contact_logs')
        .insert({
          nvq_tracking_id: selectedRecord.id,
          contact_method: contactForm.contact_method,
          outcome: contactForm.outcome,
          notes: contactForm.notes,
          follow_up_date: contactForm.follow_up_date || null,
          created_by: authData?.user?.id,
        });

      if (logError) throw logError;

      const updateData: any = {
        last_contacted_date: format(new Date(), 'yyyy-MM-dd'),
      };

      if (contactForm.outcome === 'interested') {
        updateData.nvq_status = 'interested';
      } else if (contactForm.outcome === 'enrolled') {
        updateData.nvq_status = 'enrolled';
      } else if (contactForm.outcome === 'not_interested') {
        updateData.nvq_status = 'declined';
      } else if (selectedRecord.nvq_status === 'eligible') {
        updateData.nvq_status = 'contacted';
      }

      if (contactForm.follow_up_date) {
        updateData.nvq_reminder_date = contactForm.follow_up_date;
      }

      const { error: updateError } = await supabase
        .from('nvq_tracking')
        .update(updateData)
        .eq('id', selectedRecord.id);

      if (updateError) throw updateError;

      toast.success('Contact logged');
      setContactDialogOpen(false);
      setContactForm({
        contact_method: 'phone',
        outcome: 'reached',
        notes: '',
        follow_up_date: '',
      });
      loadNvqRecords();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Failed to log contact');
    }
  };

  const toggleSelectAll = () => {
    if (selectedRecords.length === filteredRecords.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredRecords.map(r => r.id));
    }
  };

  const toggleSelect = (recordId: string) => {
    if (selectedRecords.includes(recordId)) {
      setSelectedRecords(selectedRecords.filter(id => id !== recordId));
    } else {
      setSelectedRecords([...selectedRecords, recordId]);
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-primary mb-2 flex items-center gap-3">
                <Award className="h-10 w-10 text-blue-600" />
                NVQ Follow-ups
              </h1>
              <p className="text-muted-foreground text-lg">
                Track and manage NVQ Level 2 upsell opportunities
              </p>
            </div>
            <Button onClick={loadNvqRecords} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className={`cursor-pointer transition-all ${filter === 'overdue' ? 'ring-2 ring-red-500' : ''}`} onClick={() => setFilter('overdue')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Overdue</p>
                  <p className="text-3xl font-bold text-red-600">{overdueCount}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all ${filter === 'today' ? 'ring-2 ring-amber-500' : ''}`} onClick={() => setFilter('today')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Due Today</p>
                  <p className="text-3xl font-bold text-amber-600">{todayCount}</p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all ${filter === 'this_week' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('this_week')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">This Week</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {nvqRecords.filter(r => {
                      const reminderDate = parseISO(r.nvq_reminder_date);
                      return isWithinInterval(reminderDate, {
                        start: startOfWeek(new Date(), { weekStartsOn: 1 }),
                        end: endOfWeek(new Date(), { weekStartsOn: 1 }),
                      });
                    }).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all ${filter === 'all_active' ? 'ring-2 ring-primary' : ''}`} onClick={() => setFilter('all_active')}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">All Active</p>
                  <p className="text-3xl font-bold text-primary">{nvqRecords.length}</p>
                </div>
                <User className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, phone, or course..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="all_active">All Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>

              {selectedRecords.length > 0 && (
                <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-sm text-slate-600">
                    {selectedRecords.length} selected
                  </span>
                  <Button size="sm" variant="outline" onClick={() => handleBulkSnooze(7)}>
                    Snooze +7d
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkSnooze(14)}>
                    Snooze +14d
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkMarkContacted}>
                    Mark Contacted
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="h-12 w-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-600">No NVQ follow-ups found</p>
              <p className="text-sm text-slate-500">
                {filter !== 'all_active' ? 'Try changing the filter or ' : ''}
                NVQ tracking is automatically created when marking candidates as passed.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedRecords.length === filteredRecords.length && filteredRecords.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Card Expiry</TableHead>
                  <TableHead>Reminder</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const reminderDate = parseISO(record.nvq_reminder_date);
                  const isOverdue = isPast(reminderDate) && !isToday(reminderDate);
                  const isDueToday = isToday(reminderDate);
                  const expiryDate = record.red_card_expiry_date ? parseISO(record.red_card_expiry_date) : null;

                  return (
                    <TableRow key={record.id} className={getRowColor(record)}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRecords.includes(record.id)}
                          onCheckedChange={() => toggleSelect(record.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {record.candidates?.first_name} {record.candidates?.last_name}
                        </div>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          {record.candidates?.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${record.candidates.phone}`} className="hover:underline">
                                {record.candidates.phone}
                              </a>
                            </div>
                          )}
                          {record.candidates?.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <a href={`mailto:${record.candidates.email}`} className="hover:underline">
                                {record.candidates.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {record.source_course?.courses?.title || 'N/A'}
                        </div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {record.accreditation_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {expiryDate ? (
                          <div className={isPast(expiryDate) ? 'text-red-600' : ''}>
                            {format(expiryDate, 'dd/MM/yyyy')}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className={`font-medium ${isOverdue ? 'text-red-600' : isDueToday ? 'text-amber-600' : ''}`}>
                          {format(reminderDate, 'dd/MM/yyyy')}
                        </div>
                        {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                        {isDueToday && <Badge className="bg-amber-500 text-xs">Today</Badge>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.nvq_status}
                          onValueChange={(value) => handleUpdateStatus(record.id, value)}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <Badge className={`${getNvqStatusColor(record.nvq_status)} text-xs`}>
                              {record.nvq_status.replace('_', ' ')}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eligible">Eligible</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="enrolled">Enrolled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                            <SelectItem value="not_required">Not Required</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {record.last_contacted_date ? (
                          format(parseISO(record.last_contacted_date), 'dd/MM/yyyy')
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setContactDialogOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSnooze(record.id, 7)}
                            title="Snooze 7 days"
                          >
                            +7d
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSnooze(record.id, 14)}
                            title="Snooze 14 days"
                          >
                            +14d
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                Log NVQ Contact
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedRecord && (
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-sm font-medium">
                    {selectedRecord.candidates?.first_name} {selectedRecord.candidates?.last_name}
                  </p>
                  <p className="text-xs text-slate-600">
                    {selectedRecord.source_course?.courses?.title} ({selectedRecord.accreditation_type})
                  </p>
                  {selectedRecord.candidates?.phone && (
                    <p className="text-xs text-slate-600 mt-1">
                      <a href={`tel:${selectedRecord.candidates.phone}`} className="text-blue-600 hover:underline">
                        {selectedRecord.candidates.phone}
                      </a>
                    </p>
                  )}
                  {selectedRecord.candidates?.email && (
                    <p className="text-xs text-slate-600">
                      <a href={`mailto:${selectedRecord.candidates.email}`} className="text-blue-600 hover:underline">
                        {selectedRecord.candidates.email}
                      </a>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Method</Label>
                  <Select
                    value={contactForm.contact_method}
                    onValueChange={(value) => setContactForm({ ...contactForm, contact_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select
                    value={contactForm.outcome}
                    onValueChange={(value) => setContactForm({ ...contactForm, outcome: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reached">Reached - General</SelectItem>
                      <SelectItem value="interested">Interested in NVQ</SelectItem>
                      <SelectItem value="enrolled">Enrolled in NVQ</SelectItem>
                      <SelectItem value="callback_requested">Callback Requested</SelectItem>
                      <SelectItem value="no_answer">No Answer</SelectItem>
                      <SelectItem value="voicemail">Left Voicemail</SelectItem>
                      <SelectItem value="wrong_number">Wrong Number</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_notes">Notes</Label>
                <Textarea
                  id="contact_notes"
                  placeholder="Details of the conversation..."
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow_up_date">Next Follow-up Date (optional)</Label>
                <Input
                  id="follow_up_date"
                  type="date"
                  value={contactForm.follow_up_date}
                  onChange={(e) => setContactForm({ ...contactForm, follow_up_date: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleLogContact} className="flex-1">
                  Log Contact
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setContactDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
