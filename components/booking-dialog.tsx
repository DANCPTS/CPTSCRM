'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UserPlus, Users, User } from 'lucide-react';

interface BookingDialogProps {
  open: boolean;
  onClose: () => void;
  prefillData?: {
    leadId?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    companyName?: string;
    courseName?: string;
    courseDates?: string;
    numberOfDelegates?: number;
    invoiceNumber?: string;
    invoiceSent?: boolean;
    candidateId?: string;
  };
}

export function BookingDialog({ open, onClose, prefillData }: BookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
  const [isIndividual, setIsIndividual] = useState(false);
  const [bookingType, setBookingType] = useState<'company' | 'individual'>('company');
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseRuns, setCourseRuns] = useState<any[]>([]);
  const [filteredCourseRuns, setFilteredCourseRuns] = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);

  const [bookingData, setBookingData] = useState({
    contact_id: '',
    company_id: '',
    candidate_id: '',
    course_id: '',
    course_run_id: '',
    accreditation: '',
    status: 'reserved',
    amount: '',
    invoice_no: '',
    certificate_no: '',
  });

  const [isOtherCourse, setIsOtherCourse] = useState(false);
  const [newCourseData, setNewCourseData] = useState({
    title: '',
    code: '',
  });

  const [isOtherRun, setIsOtherRun] = useState(false);
  const [newRunData, setNewRunData] = useState({
    start_date: '',
    end_date: '',
    location: '',
    max_participants: 12,
  });

  const [availableAccreditations, setAvailableAccreditations] = useState<any[]>([]);

  const [newContactData, setNewContactData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    language: 'EN',
    company_id: '',
  });

  const [newCompanyData, setNewCompanyData] = useState({
    name: '',
    address: '',
    city: '',
    postcode: '',
  });

  useEffect(() => {
    if (open) {
      loadData();
      if (prefillData) {
        prefillFormData();
      }
    }
  }, [open, prefillData]);

  const prefillFormData = async () => {
    if (!prefillData) return;

    if (prefillData.invoiceNumber) {
      setBookingData(prev => ({ ...prev, invoice_no: prefillData.invoiceNumber || '' }));
    }

    if (prefillData.candidateId) {
      setBookingData(prev => ({ ...prev, candidate_id: prefillData.candidateId || '' }));
      setBookingType('individual');
    }

    if (prefillData.courseName) {
      const matchingCourse = courses.find(c =>
        c.title.toLowerCase().includes(prefillData.courseName!.toLowerCase())
      );
      if (matchingCourse) {
        setBookingData(prev => ({ ...prev, course_id: matchingCourse.id }));
      }
    }

    if (prefillData.companyName) {
      const matchingCompany = companies.find(c =>
        c.name.toLowerCase().includes(prefillData.companyName!.toLowerCase())
      );
      if (matchingCompany) {
        setBookingData(prev => ({ ...prev, company_id: matchingCompany.id }));
      }
    }

    if (!prefillData.candidateId && (prefillData.contactName || prefillData.contactEmail)) {
      const [firstName, ...lastNameParts] = (prefillData.contactName || '').split(' ');
      const lastName = lastNameParts.join(' ');

      setClientType('new');
      setNewContactData({
        first_name: firstName || '',
        last_name: lastName || '',
        email: prefillData.contactEmail || '',
        phone: prefillData.contactPhone || '',
        language: 'EN',
        company_id: '',
      });

      if (prefillData.companyName) {
        setIsIndividual(false);
        setNewCompanyData(prev => ({
          ...prev,
          name: prefillData.companyName || '',
        }));
      } else {
        setIsIndividual(true);
      }
    }
  };

  useEffect(() => {
    if (bookingData.company_id) {
      const filtered = contacts.filter(c => c.company_id === bookingData.company_id);
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [bookingData.company_id, contacts]);

  useEffect(() => {
    if (bookingData.course_id) {
      const filtered = courseRuns.filter(r => r.course_id === bookingData.course_id);
      setFilteredCourseRuns(filtered);
      setBookingData(prev => ({ ...prev, course_run_id: '' }));
    } else {
      setFilteredCourseRuns([]);
    }
  }, [bookingData.course_id, courseRuns]);

  useEffect(() => {
    if (bookingData.course_run_id) {
      loadAccreditationsForCourse();
    }
  }, [bookingData.course_run_id]);

  const loadData = async () => {
    try {
      const [companiesRes, contactsRes, candidatesRes, coursesRes, runsRes] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('contacts').select('id, first_name, last_name, company_id').order('last_name'),
        supabase.from('candidates').select('id, first_name, last_name, email, phone').eq('status', 'active').order('last_name'),
        supabase.from('courses').select('id, title').order('title'),
        supabase
          .from('course_runs')
          .select('id, start_date, end_date, location, course_id, courses(id, title)')
          .gte('start_date', new Date().toISOString().split('T')[0])
          .order('start_date'),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (candidatesRes.error) throw candidatesRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (runsRes.error) throw runsRes.error;

      setCompanies(companiesRes.data || []);
      setContacts(contactsRes.data || []);
      setCandidates(candidatesRes.data || []);
      setCourses(coursesRes.data || []);
      setCourseRuns(runsRes.data || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    }
  };

  const loadAccreditationsForCourse = async () => {
    const selectedRun = courseRuns.find(r => r.id === bookingData.course_run_id);
    if (!selectedRun?.course_id) return;

    try {
      const { data, error } = await supabase
        .from('course_accreditation_pricing')
        .select('*')
        .eq('course_id', selectedRun.course_id);

      if (error) throw error;

      setAvailableAccreditations(data || []);

      if (data && data.length > 0) {
        setBookingData(prev => ({ ...prev, accreditation: data[0].accreditation, amount: data[0].price.toString() }));
      }
    } catch (error) {
      console.error('Failed to load accreditations:', error);
    }
  };

  const handleAccreditationChange = (accreditation: string) => {
    const pricing = availableAccreditations.find(a => a.accreditation === accreditation);
    setBookingData(prev => ({
      ...prev,
      accreditation,
      amount: pricing ? pricing.price.toString() : prev.amount,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let contactId = bookingData.contact_id;
      let companyId: string | null = bookingData.company_id;

      if (clientType === 'existing' && bookingType === 'individual') {
        if (!bookingData.candidate_id) {
          toast.error('Please select a candidate');
          setLoading(false);
          return;
        }

        const { data: candidate } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', bookingData.candidate_id)
          .single();

        if (candidate) {
          const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .insert([{
              first_name: candidate.first_name,
              last_name: candidate.last_name,
              email: candidate.email || '',
              phone: candidate.phone || '',
              language: 'EN',
              company_id: null,
            }])
            .select()
            .single();

          if (contactError) throw contactError;
          contactId = contact.id;
          companyId = null;
        }
      } else if (clientType === 'new') {
        if (!isIndividual) {
          if (!newCompanyData.name && !newContactData.company_id) {
            toast.error('Please provide company information or select "Individual Client"');
            setLoading(false);
            return;
          }

          if (newCompanyData.name) {
            const { data: company, error: companyError } = await supabase
              .from('companies')
              .insert([newCompanyData])
              .select()
              .single();

            if (companyError) throw companyError;
            companyId = company.id;
          } else {
            companyId = newContactData.company_id;
          }
        } else {
          companyId = null;
        }

        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .insert([{ ...newContactData, company_id: companyId }])
          .select()
          .single();

        if (contactError) throw contactError;
        contactId = contact.id;
      }

      // Look up or create candidate by contact email
      let candidateId = null;
      if (clientType === 'existing' && bookingType === 'individual') {
        candidateId = bookingData.candidate_id;
      } else {
        // Try to find or create candidate by contact email
        const { data: contact } = await supabase
          .from('contacts')
          .select('email, first_name, last_name, phone')
          .eq('id', contactId)
          .single();

        if (contact?.email) {
          const { data: candidate } = await supabase
            .from('candidates')
            .select('id')
            .eq('email', contact.email)
            .maybeSingle();

          if (candidate) {
            candidateId = candidate.id;
          } else {
            // Create new candidate
            const { data: newCandidate, error: candidateError } = await supabase
              .from('candidates')
              .insert([{
                first_name: contact.first_name,
                last_name: contact.last_name,
                email: contact.email,
                phone: contact.phone || '',
                status: 'active',
              }])
              .select()
              .single();

            if (candidateError) throw candidateError;
            candidateId = newCandidate.id;
          }
        }
      }

      let courseId = bookingData.course_id;

      if (isOtherCourse) {
        if (!newCourseData.title) {
          toast.error('Please enter a course name');
          setLoading(false);
          return;
        }

        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          toast.error('You must be logged in');
          setLoading(false);
          return;
        }

        const { data: newCourse, error: courseError } = await supabase
          .from('courses')
          .insert([{
            title: newCourseData.title,
            code: newCourseData.code || newCourseData.title.substring(0, 10).toUpperCase(),
            description: '',
            duration_days: 1,
          }])
          .select()
          .single();

        if (courseError) throw courseError;
        courseId = newCourse.id;
      }

      let courseRunId = bookingData.course_run_id;

      if (isOtherRun) {
        if (!newRunData.start_date || !newRunData.location) {
          toast.error('Please fill in all required fields for the new course run');
          setLoading(false);
          return;
        }

        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          toast.error('You must be logged in');
          setLoading(false);
          return;
        }

        const { data: newRun, error: runError } = await supabase
          .from('course_runs')
          .insert([{
            course_id: courseId,
            start_date: newRunData.start_date,
            end_date: newRunData.end_date || newRunData.start_date,
            location: newRunData.location,
            seats_total: newRunData.max_participants,
            seats_booked: 0,
          }])
          .select()
          .single();

        if (runError) throw runError;
        courseRunId = newRun.id;
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            contact_id: contactId,
            company_id: companyId,
            candidate_id: candidateId,
            course_run_id: courseRunId,
            status: bookingData.status,
            amount: parseFloat(bookingData.amount) || 0,
            invoice_no: bookingData.invoice_no || null,
            certificate_no: bookingData.certificate_no || null,
            lead_id: prefillData?.leadId || null,
            invoice_sent: prefillData?.invoiceSent || false,
          },
        ]);

      if (bookingError) throw bookingError;

      toast.success('Booking created successfully');
      onClose();
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBookingData({
      contact_id: '',
      company_id: '',
      candidate_id: '',
      course_id: '',
      course_run_id: '',
      accreditation: '',
      status: 'reserved',
      amount: '',
      invoice_no: '',
      certificate_no: '',
    });
    setNewContactData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      language: 'EN',
      company_id: '',
    });
    setNewCompanyData({
      name: '',
      address: '',
      city: '',
      postcode: '',
    });
    setIsOtherCourse(false);
    setNewCourseData({
      title: '',
      code: '',
    });
    setIsOtherRun(false);
    setNewRunData({
      start_date: '',
      end_date: '',
      location: '',
      max_participants: 12,
    });
    setClientType('existing');
    setIsIndividual(false);
    setBookingType('company');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
          <DialogDescription>Create a new course booking</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={clientType} onValueChange={(v) => setClientType(v as 'existing' | 'new')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">
                <Users className="h-4 w-4 mr-2" />
                Existing Client
              </TabsTrigger>
              <TabsTrigger value="new">
                <UserPlus className="h-4 w-4 mr-2" />
                New Client
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-4 mt-4">
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
                <Label className="mb-2 block">Booking Type</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={bookingType === 'company' ? 'default' : 'outline'}
                    onClick={() => {
                      setBookingType('company');
                      setBookingData({ ...bookingData, candidate_id: '', contact_id: '', company_id: '' });
                    }}
                    className="flex-1"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Company
                  </Button>
                  <Button
                    type="button"
                    variant={bookingType === 'individual' ? 'default' : 'outline'}
                    onClick={() => {
                      setBookingType('individual');
                      setBookingData({ ...bookingData, candidate_id: '', contact_id: '', company_id: '' });
                    }}
                    className="flex-1"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Individual
                  </Button>
                </div>
              </div>

              {bookingType === 'company' ? (
                <>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Select
                      value={bookingData.company_id}
                      onValueChange={(value) => setBookingData({ ...bookingData, company_id: value, contact_id: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select company (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Contacts</SelectItem>
                        {companies.map(company => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Contact *</Label>
                    <Select
                      value={bookingData.contact_id}
                      onValueChange={(value) => setBookingData({ ...bookingData, contact_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(bookingData.company_id && bookingData.company_id !== 'all' ? filteredContacts : contacts).map(contact => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.first_name} {contact.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Candidate *</Label>
                  <Select
                    value={bookingData.candidate_id}
                    onValueChange={(value) => setBookingData({ ...bookingData, candidate_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select candidate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map(candidate => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.first_name} {candidate.last_name}
                          {candidate.email && ` (${candidate.email})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-600">
                    Select from existing candidates in the system
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-4 mt-4">
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="individual"
                    checked={isIndividual}
                    onChange={(e) => {
                      setIsIndividual(e.target.checked);
                      if (e.target.checked) {
                        setNewContactData({ ...newContactData, company_id: '' });
                        setNewCompanyData({ name: '', address: '', city: '', postcode: '' });
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-600" />
                    <label htmlFor="individual" className="text-sm font-medium cursor-pointer">
                      Individual Client (Paying for themselves)
                    </label>
                  </div>
                </div>
                {isIndividual && (
                  <p className="text-xs text-slate-600 mt-2 ml-7">
                    No company will be associated with this booking
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={newContactData.first_name}
                    onChange={(e) => setNewContactData({ ...newContactData, first_name: e.target.value })}
                    required={clientType === 'new'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={newContactData.last_name}
                    onChange={(e) => setNewContactData({ ...newContactData, last_name: e.target.value })}
                    required={clientType === 'new'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newContactData.email}
                    onChange={(e) => setNewContactData({ ...newContactData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newContactData.phone}
                    onChange={(e) => setNewContactData({ ...newContactData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={newContactData.language}
                    onValueChange={(value) => setNewContactData({ ...newContactData, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EN">English</SelectItem>
                      <SelectItem value="DE">German</SelectItem>
                      <SelectItem value="FR">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isIndividual && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm">Company Information</h4>

                <div className="space-y-2">
                  <Label>Use Existing Company</Label>
                  <Select
                    value={newContactData.company_id}
                    onValueChange={(value) => {
                      setNewContactData({ ...newContactData, company_id: value });
                      setNewCompanyData({ name: '', address: '', city: '', postcode: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Or select existing company..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Create New Company</SelectItem>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(!newContactData.company_id || newContactData.company_id === 'none') && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name *</Label>
                      <Input
                        id="company_name"
                        value={newCompanyData.name}
                        onChange={(e) => setNewCompanyData({ ...newCompanyData, name: e.target.value })}
                        required={clientType === 'new' && !newContactData.company_id}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company_city">City</Label>
                        <Input
                          id="company_city"
                          value={newCompanyData.city}
                          onChange={(e) => setNewCompanyData({ ...newCompanyData, city: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_postcode">Postcode</Label>
                        <Input
                          id="company_postcode"
                          value={newCompanyData.postcode}
                          onChange={(e) => setNewCompanyData({ ...newCompanyData, postcode: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company_address">Address</Label>
                      <Input
                        id="company_address"
                        value={newCompanyData.address}
                        onChange={(e) => setNewCompanyData({ ...newCompanyData, address: e.target.value })}
                      />
                    </div>
                  </>
                )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Booking Details</h4>

            <div className="space-y-2">
              <Label>Course Type *</Label>
              <Select
                value={isOtherCourse ? 'other' : bookingData.course_id}
                onValueChange={(value) => {
                  if (value === 'other') {
                    setIsOtherCourse(true);
                    setBookingData({ ...bookingData, course_id: '' });
                  } else {
                    setIsOtherCourse(false);
                    setBookingData({ ...bookingData, course_id: value });
                  }
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course type..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">
                    Other (Create new course)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isOtherCourse && (
              <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                <p className="text-sm text-slate-600">Create a new course type</p>

                <div className="space-y-2">
                  <Label>Course Name *</Label>
                  <Input
                    value={newCourseData.title}
                    onChange={(e) => setNewCourseData({ ...newCourseData, title: e.target.value })}
                    placeholder="e.g., Telehandler Assessment"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Course Code</Label>
                  <Input
                    value={newCourseData.code}
                    onChange={(e) => setNewCourseData({ ...newCourseData, code: e.target.value })}
                    placeholder="e.g., TH-ASS (optional)"
                  />
                </div>
              </div>
            )}

            {(bookingData.course_id || isOtherCourse) && (
              <>
                <div className="space-y-2">
                  <Label>Available Dates *</Label>
                  <Select
                    value={isOtherRun ? 'other' : bookingData.course_run_id}
                    onValueChange={(value) => {
                      if (value === 'other') {
                        setIsOtherRun(true);
                        setBookingData({ ...bookingData, course_run_id: '' });
                      } else {
                        setIsOtherRun(false);
                        setBookingData({ ...bookingData, course_run_id: value });
                      }
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select date..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCourseRuns.length > 0 && (
                        filteredCourseRuns.map(run => {
                          const startDate = new Date(run.start_date);
                          const endDate = new Date(run.end_date);
                          const startDay = startDate.getDate();
                          const endDay = endDate.getDate();
                          const month = startDate.toLocaleDateString('en-GB', { month: 'short' });
                          const year = startDate.getFullYear();

                          return (
                            <SelectItem key={run.id} value={run.id}>
                              {startDay}{startDay === endDay ? '' : ` - ${endDay}`} {month} {year} - {run.location}
                            </SelectItem>
                          );
                        })
                      )}
                      <SelectItem value="other">
                        Other (Create new date)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isOtherRun && (
                  <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                    <p className="text-sm text-slate-600">Create a new course run for this booking</p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date *</Label>
                        <Input
                          type="date"
                          value={newRunData.start_date}
                          onChange={(e) => setNewRunData({ ...newRunData, start_date: e.target.value, end_date: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>End Date *</Label>
                        <Input
                          type="date"
                          value={newRunData.end_date}
                          onChange={(e) => setNewRunData({ ...newRunData, end_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Location *</Label>
                      <Input
                        value={newRunData.location}
                        onChange={(e) => setNewRunData({ ...newRunData, location: e.target.value })}
                        placeholder="e.g., Client Site, Your Training Centre"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Participants</Label>
                      <Input
                        type="number"
                        value={newRunData.max_participants}
                        onChange={(e) => setNewRunData({ ...newRunData, max_participants: parseInt(e.target.value) || 12 })}
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {availableAccreditations.length > 0 && (
              <div className="space-y-2">
                <Label>Accreditation *</Label>
                <Select
                  value={bookingData.accreditation}
                  onValueChange={handleAccreditationChange}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select accreditation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccreditations.map(accred => (
                      <SelectItem key={accred.accreditation} value={accred.accreditation}>
                        {accred.accreditation} - £{accred.price.toFixed(2)} + VAT
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (plus VAT) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={bookingData.amount}
                  onChange={(e) => setBookingData({ ...bookingData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={bookingData.status}
                  onValueChange={(value) => setBookingData({ ...bookingData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_no">Invoice No</Label>
                <Input
                  id="invoice_no"
                  value={bookingData.invoice_no}
                  onChange={(e) => setBookingData({ ...bookingData, invoice_no: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificate_no">Certificate No</Label>
                <Input
                  id="certificate_no"
                  value={bookingData.certificate_no}
                  onChange={(e) => setBookingData({ ...bookingData, certificate_no: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Booking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
