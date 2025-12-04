'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Trash2, Calendar, FileText, Sparkles } from 'lucide-react';
import { NotesDialog } from '@/components/notes-dialog';
import { NotesList } from '@/components/notes-list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BookingDialog } from '@/components/booking-dialog';

interface LeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead?: any;
}

export function LeadDialog({ open, onClose, lead }: LeadDialogProps) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [previousStatus, setPreviousStatus] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesRefresh, setNotesRefresh] = useState(0);
  const [activeTab, setActiveTab] = useState('details');
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    source: 'email',
    channel: 'email',
    training_interest: [] as string[],
    preferred_language: 'EN',
    location: '',
    status: 'new',
    notes: '',
    gdpr_consent: false,
    assigned_to: '',
    quoted_course: '',
    quoted_price: '',
    quoted_currency: 'GBP',
    quoted_dates: '',
    quoted_venue: '',
    number_of_delegates: '',
    quote_notes: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        company_name: lead.company_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || 'email',
        channel: lead.channel || 'email',
        training_interest: lead.training_interest || [],
        preferred_language: lead.preferred_language || 'EN',
        location: lead.location || '',
        status: lead.status || 'new',
        notes: lead.notes || '',
        gdpr_consent: lead.gdpr_consent || false,
        assigned_to: lead.assigned_to || '',
        quoted_course: lead.quoted_course || '',
        quoted_price: lead.quoted_price || '',
        quoted_currency: lead.quoted_currency || 'GBP',
        quoted_dates: lead.quoted_dates || '',
        quoted_venue: lead.quoted_venue || '',
        number_of_delegates: lead.number_of_delegates || '',
        quote_notes: lead.quote_notes || '',
      });
      setPreviousStatus(lead.status || 'new');
    } else {
      setFormData({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        source: 'email',
        channel: 'email',
        training_interest: [],
        preferred_language: 'EN',
        location: '',
        status: 'new',
        notes: '',
        gdpr_consent: false,
        assigned_to: userProfile?.id || '',
        quoted_course: '',
        quoted_price: '',
        quoted_currency: 'GBP',
        quoted_dates: '',
        quoted_venue: '',
        number_of_delegates: '',
        quote_notes: '',
      });
      setPreviousStatus('new');
    }
  }, [lead, open, userProfile]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .order('full_name');
    setUsers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let companyId = null;

      if (formData.company_name && formData.company_name.trim()) {
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id, account_manager_id')
          .ilike('name', formData.company_name.trim())
          .maybeSingle();

        if (existingCompany) {
          companyId = existingCompany.id;

          if (!lead && userProfile?.id && !existingCompany.account_manager_id) {
            await supabase
              .from('companies')
              .update({
                account_manager_id: userProfile.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingCompany.id);
          }
        } else {
          const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert({
              name: formData.company_name.trim(),
              address: '',
              city: '',
              postcode: '',
              notes: `Automatically created from lead: ${formData.name}`,
              account_manager_id: userProfile?.id || null,
            })
            .select('id')
            .single();

          if (companyError) throw companyError;
          companyId = newCompany.id;
        }
      }

      const dataToSave = {
        ...formData,
        company_id: companyId,
        gdpr_consent_date: formData.gdpr_consent ? new Date().toISOString() : null,
        number_of_delegates: formData.number_of_delegates ? parseInt(formData.number_of_delegates) : null,
        quoted_price: formData.quoted_price ? parseFloat(formData.quoted_price) : null,
      };

      const statusChangedToWon = lead && previousStatus !== 'won' && formData.status === 'won';

      if (lead) {
        const { error } = await supabase
          .from('leads')
          .update(dataToSave)
          .eq('id', lead.id);

        if (error) throw error;
        toast.success('Lead updated successfully');
      } else {
        const { error } = await supabase
          .from('leads')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Lead created successfully');
      }

      if (statusChangedToWon) {
        onClose();
        setTimeout(() => {
          setBookingDialogOpen(true);
        }, 300);
      } else {
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save lead');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const trainingOptions = [
    'Excavator',
    'Telehandler',
    'Forklift',
    'MEWP',
    'Roller',
    'Dumper',
    'Supervisor',
  ];

  const toggleTraining = (training: string) => {
    setFormData(prev => ({
      ...prev,
      training_interest: prev.training_interest.includes(training)
        ? prev.training_interest.filter(t => t !== training)
        : [...prev.training_interest, training],
    }));
  };

  const handleDelete = async () => {
    if (!lead) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);

      if (error) throw error;

      toast.success('Lead deleted successfully');
      setDeleteDialogOpen(false);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete lead');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          <DialogDescription>
            {lead ? 'Update lead information' : 'Add a new lead to the pipeline'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="proposal">Proposal</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1">
              <FileText className="h-3 w-3" />
              Notes
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <TabsContent value="details" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_import">Email Import</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">Preferred Channel</Label>
              <Select value={formData.channel} onValueChange={(value) => setFormData({ ...formData, channel: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Preferred Language</Label>
              <Select value={formData.preferred_language} onValueChange={(value) => setFormData({ ...formData, preferred_language: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EN">English</SelectItem>
                  <SelectItem value="PL">Polish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className={formData.status === 'won' && previousStatus !== 'won' ? 'border-green-500 ring-2 ring-green-100' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              {formData.status === 'won' && previousStatus !== 'won' && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  You'll be prompted to create a booking after saving
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Training Interest</Label>
            <div className="grid grid-cols-3 gap-2">
              {trainingOptions.map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={option}
                    checked={formData.training_interest.includes(option)}
                    onCheckedChange={() => toggleTraining(option)}
                  />
                  <label htmlFor={option} className="text-sm cursor-pointer">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
            />
          </div>

            </TabsContent>

            <TabsContent value="proposal" className="space-y-4 mt-0">
              {(formData.status === 'proposal' || formData.status === 'won') && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm">Quote Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="quoted_course">Course Name</Label>
                  <Input
                    id="quoted_course"
                    value={formData.quoted_course}
                    onChange={(e) => setFormData({ ...formData, quoted_course: e.target.value })}
                    placeholder="e.g., IPAF 3a & 3b Mobile Vertical"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quoted_price">Price + VAT</Label>
                  <Input
                    id="quoted_price"
                    type="number"
                    step="0.01"
                    value={formData.quoted_price}
                    onChange={(e) => setFormData({ ...formData, quoted_price: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500">Enter the total price including VAT</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quoted_currency">Currency</Label>
                  <Select value={formData.quoted_currency} onValueChange={(value) => setFormData({ ...formData, quoted_currency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="PLN">PLN (zł)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quoted_dates">Proposed Dates</Label>
                  <Input
                    id="quoted_dates"
                    value={formData.quoted_dates}
                    onChange={(e) => setFormData({ ...formData, quoted_dates: e.target.value })}
                    placeholder="e.g., 15-19 Jan 2025"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quoted_venue">Venue</Label>
                  <Input
                    id="quoted_venue"
                    value={formData.quoted_venue}
                    onChange={(e) => setFormData({ ...formData, quoted_venue: e.target.value })}
                    placeholder="e.g., Client Site / Training Centre"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="number_of_delegates">Number of Delegates</Label>
                  <Input
                    id="number_of_delegates"
                    type="number"
                    min="1"
                    value={formData.number_of_delegates}
                    onChange={(e) => setFormData({ ...formData, number_of_delegates: e.target.value })}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="quote_notes">Quote Notes</Label>
                  <Textarea
                    id="quote_notes"
                    value={formData.quote_notes}
                    onChange={(e) => setFormData({ ...formData, quote_notes: e.target.value })}
                    rows={2}
                    placeholder="Additional details about the quote..."
                  />
                </div>
              </div>
            </div>
              )}
              {!(formData.status === 'proposal' || formData.status === 'won') && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Quote details are available when status is Proposal or Won</p>
                </div>
              )}
            </TabsContent>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="gdpr"
              checked={formData.gdpr_consent}
              onCheckedChange={(checked) => setFormData({ ...formData, gdpr_consent: checked as boolean })}
            />
            <label htmlFor="gdpr" className="text-sm cursor-pointer">
              GDPR consent provided
            </label>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <div>
              {lead && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={loading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : lead ? 'Update Lead' : 'Create Lead'}
              </Button>
            </div>
          </DialogFooter>
          </form>

          <TabsContent value="notes" className="space-y-4 mt-0">
            {lead ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium">Meeting & Call Notes</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setNotesDialogOpen(true)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Add Note
                  </Button>
                </div>
                <NotesList
                  entityType="lead"
                  entityId={lead.id}
                  refreshTrigger={notesRefresh}
                  onNoteDeleted={() => setNotesRefresh(prev => prev + 1)}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Save the lead first to add notes</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {lead && (
          <NotesDialog
            open={notesDialogOpen}
            onOpenChange={setNotesDialogOpen}
            entityType="lead"
            entityId={lead.id}
            entityName={lead.name}
            onNoteAdded={() => {
              setNotesRefresh(prev => prev + 1);
              setNotesDialogOpen(false);
            }}
          />
        )}
      </DialogContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this lead. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? 'Deleting...' : 'Delete Lead'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BookingDialog
        open={bookingDialogOpen}
        onClose={() => {
          setBookingDialogOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
}
