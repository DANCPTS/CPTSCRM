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
import { Trash2, Calendar, FileText, Sparkles, Plus, X, GripVertical } from 'lucide-react';
import { NotesDialog } from '@/components/notes-dialog';
import { NotesList } from '@/components/notes-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface ProposalCourse {
  id?: string;
  course_name: string;
  price: string;
  currency: string;
  dates: string;
  venue: string;
  number_of_delegates: string;
  notes: string;
  display_order: number;
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
  const [proposalCourses, setProposalCourses] = useState<ProposalCourse[]>([]);
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
      loadProposalCourses(lead.id);
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
      setProposalCourses([]);
    }
  }, [lead, open, userProfile]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .order('full_name');
    setUsers(data || []);
  };

  const loadProposalCourses = async (leadId: string) => {
    const { data, error } = await supabase
      .from('proposal_courses')
      .select('*')
      .eq('lead_id', leadId)
      .order('display_order');

    if (error) {
      console.error('Error loading proposal courses:', error);
      return;
    }

    if (data && data.length > 0) {
      setProposalCourses(data.map(course => ({
        id: course.id,
        course_name: course.course_name || '',
        price: course.price?.toString() || '',
        currency: course.currency || 'GBP',
        dates: course.dates || '',
        venue: course.venue || '',
        number_of_delegates: course.number_of_delegates?.toString() || '',
        notes: course.notes || '',
        display_order: course.display_order || 0,
      })));
    } else {
      setProposalCourses([]);
    }
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
      let leadId = lead?.id;

      if (lead) {
        const { error } = await supabase
          .from('leads')
          .update(dataToSave)
          .eq('id', lead.id);

        if (error) throw error;

        if (proposalCourses.length > 0) {
          const { error: deleteError } = await supabase
            .from('proposal_courses')
            .delete()
            .eq('lead_id', lead.id);

          if (deleteError) throw deleteError;

          const coursesToInsert = proposalCourses.map((course, index) => ({
            lead_id: lead.id,
            course_name: course.course_name,
            price: parseFloat(course.price) || 0,
            currency: course.currency,
            dates: course.dates,
            venue: course.venue,
            number_of_delegates: parseInt(course.number_of_delegates) || 1,
            notes: course.notes,
            display_order: index,
            created_by: userProfile?.id,
          }));

          const { error: insertError } = await supabase
            .from('proposal_courses')
            .insert(coursesToInsert);

          if (insertError) throw insertError;
        }

        toast.success('Lead updated successfully');
      } else {
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert([dataToSave])
          .select('id')
          .single();

        if (error) throw error;
        leadId = newLead.id;

        if (proposalCourses.length > 0) {
          const coursesToInsert = proposalCourses.map((course, index) => ({
            lead_id: newLead.id,
            course_name: course.course_name,
            price: parseFloat(course.price) || 0,
            currency: course.currency,
            dates: course.dates,
            venue: course.venue,
            number_of_delegates: parseInt(course.number_of_delegates) || 1,
            notes: course.notes,
            display_order: index,
            created_by: userProfile?.id,
          }));

          const { error: insertError } = await supabase
            .from('proposal_courses')
            .insert(coursesToInsert);

          if (insertError) throw insertError;
        }

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

  const addCourse = () => {
    setProposalCourses([
      ...proposalCourses,
      {
        course_name: '',
        price: '',
        currency: 'GBP',
        dates: '',
        venue: '',
        number_of_delegates: '1',
        notes: '',
        display_order: proposalCourses.length,
      },
    ]);
  };

  const removeCourse = (index: number) => {
    setProposalCourses(proposalCourses.filter((_, i) => i !== index));
  };

  const updateCourse = (index: number, field: keyof ProposalCourse, value: string) => {
    const updated = [...proposalCourses];
    updated[index] = { ...updated[index], [field]: value };
    setProposalCourses(updated);
  };

  const calculateTotals = () => {
    const totalDelegates = proposalCourses.reduce(
      (sum, course) => sum + (parseInt(course.number_of_delegates) || 0),
      0
    );
    const totalPrice = proposalCourses.reduce(
      (sum, course) => sum + (parseFloat(course.price) || 0),
      0
    );
    return { totalDelegates, totalPrice };
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
              {(formData.status === 'proposal' || formData.status === 'won') ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm">Courses in Proposal</h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addCourse}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Course
                    </Button>
                  </div>

                  {proposalCourses.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground mb-3">No courses added yet</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addCourse}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Course
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {proposalCourses.map((course, index) => (
                        <Card key={index} className="relative">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-sm">Course {index + 1}</CardTitle>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeCourse(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2 col-span-2">
                                <Label>Course Name</Label>
                                <Input
                                  value={course.course_name}
                                  onChange={(e) => updateCourse(index, 'course_name', e.target.value)}
                                  placeholder="e.g., IPAF 3a & 3b Mobile Vertical"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Price + VAT</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={course.price}
                                  onChange={(e) => updateCourse(index, 'price', e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select
                                  value={course.currency}
                                  onValueChange={(value) => updateCourse(index, 'currency', value)}
                                >
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
                                <Label>Proposed Dates</Label>
                                <Input
                                  value={course.dates}
                                  onChange={(e) => updateCourse(index, 'dates', e.target.value)}
                                  placeholder="e.g., 15-19 Jan 2025"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Venue</Label>
                                <Input
                                  value={course.venue}
                                  onChange={(e) => updateCourse(index, 'venue', e.target.value)}
                                  placeholder="e.g., Client Site"
                                />
                              </div>

                              <div className="space-y-2 col-span-2">
                                <Label>Number of Delegates</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={course.number_of_delegates}
                                  onChange={(e) => updateCourse(index, 'number_of_delegates', e.target.value)}
                                  placeholder="1"
                                />
                              </div>

                              <div className="space-y-2 col-span-2">
                                <Label>Course Notes</Label>
                                <Textarea
                                  value={course.notes}
                                  onChange={(e) => updateCourse(index, 'notes', e.target.value)}
                                  rows={2}
                                  placeholder="Additional details..."
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {proposalCourses.length > 0 && (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium">Total Delegates:</span>
                              <span className="font-bold">{calculateTotals().totalDelegates}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-2">
                              <span className="font-medium">Total Price (plus VAT):</span>
                              <span className="font-bold">
                                {proposalCourses[0]?.currency || 'GBP'} {calculateTotals().totalPrice.toFixed(2)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Proposal details are available when status is Proposal or Won</p>
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
