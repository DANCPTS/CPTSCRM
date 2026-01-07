'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UserPlus, Users, User, AlertTriangle, Search, Copy, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

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
  const [duplicateWarnings, setDuplicateWarnings] = useState<any[]>([]);
  const [preSearchQuery, setPreSearchQuery] = useState('');
  const [preSearchResults, setPreSearchResults] = useState<any[]>([]);

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
    vat_exempt: false,
    payment_link: '',
    start_time: '08:00',
  });

  const startTimeOptions = [
    { value: '06:00', label: '6:00 AM' },
    { value: '06:30', label: '6:30 AM' },
    { value: '07:00', label: '7:00 AM' },
    { value: '07:30', label: '7:30 AM' },
    { value: '08:00', label: '8:00 AM' },
    { value: '08:30', label: '8:30 AM' },
    { value: '09:00', label: '9:00 AM' },
    { value: '09:30', label: '9:30 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '10:30', label: '10:30 AM' },
    { value: '11:00', label: '11:00 AM' },
  ];

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
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [confirmedOverlap, setConfirmedOverlap] = useState(false);

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
        supabase.from('contacts').select('id, first_name, last_name, email, phone, company_id, companies(name)').order('last_name'),
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

  useEffect(() => {
    if (clientType === 'new') {
      checkForDuplicates();
    } else {
      setDuplicateWarnings([]);
    }
  }, [newContactData.first_name, newContactData.last_name, newContactData.email, clientType]);

  const checkForDuplicates = async () => {
    if (!newContactData.first_name && !newContactData.last_name && !newContactData.email) {
      setDuplicateWarnings([]);
      return;
    }

    try {
      const potentialDuplicates: any[] = [];

      if (newContactData.email && newContactData.email.length > 3) {
        const { data: contactsByEmail } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, companies(name)')
          .ilike('email', newContactData.email)
          .limit(5);

        const { data: candidatesByEmail } = await supabase
          .from('candidates')
          .select('id, first_name, last_name, email, phone')
          .ilike('email', newContactData.email)
          .eq('status', 'active')
          .limit(5);

        if (contactsByEmail) {
          potentialDuplicates.push(...contactsByEmail.map(c => ({ ...c, type: 'contact' })));
        }
        if (candidatesByEmail) {
          potentialDuplicates.push(...candidatesByEmail.map(c => ({ ...c, type: 'candidate' })));
        }
      }

      if (newContactData.first_name && newContactData.last_name &&
          newContactData.first_name.length > 1 && newContactData.last_name.length > 1) {
        const { data: contactsByName } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone, companies(name)')
          .ilike('first_name', newContactData.first_name)
          .ilike('last_name', newContactData.last_name)
          .limit(5);

        const { data: candidatesByName } = await supabase
          .from('candidates')
          .select('id, first_name, last_name, email, phone')
          .ilike('first_name', newContactData.first_name)
          .ilike('last_name', newContactData.last_name)
          .eq('status', 'active')
          .limit(5);

        if (contactsByName) {
          contactsByName.forEach(contact => {
            if (!potentialDuplicates.find(d => d.id === contact.id && d.type === 'contact')) {
              potentialDuplicates.push({ ...contact, type: 'contact' });
            }
          });
        }
        if (candidatesByName) {
          candidatesByName.forEach(candidate => {
            if (!potentialDuplicates.find(d => d.id === candidate.id && d.type === 'candidate')) {
              potentialDuplicates.push({ ...candidate, type: 'candidate' });
            }
          });
        }
      }

      setDuplicateWarnings(potentialDuplicates);
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    }
  };

  useEffect(() => {
    if (preSearchQuery.length > 2) {
      searchClients();
    } else {
      setPreSearchResults([]);
    }
  }, [preSearchQuery]);

  const searchClients = async () => {
    try {
      const { data: contactResults } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, companies(name)')
        .or(`first_name.ilike.%${preSearchQuery}%,last_name.ilike.%${preSearchQuery}%,email.ilike.%${preSearchQuery}%`)
        .limit(10);

      const { data: candidateResults } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, email, phone')
        .or(`first_name.ilike.%${preSearchQuery}%,last_name.ilike.%${preSearchQuery}%,email.ilike.%${preSearchQuery}%`)
        .eq('status', 'active')
        .limit(10);

      const results = [
        ...(contactResults || []).map(c => ({ ...c, type: 'contact' })),
        ...(candidateResults || []).map(c => ({ ...c, type: 'candidate' })),
      ];

      setPreSearchResults(results);
    } catch (error) {
      console.error('Error searching clients:', error);
    }
  };

  const useExistingClient = (client: any) => {
    if (client.type === 'contact') {
      setClientType('existing');
      setBookingType('company');
      setBookingData(prev => ({ ...prev, contact_id: client.id, company_id: client.company_id || '' }));
    } else if (client.type === 'candidate') {
      setClientType('existing');
      setBookingType('individual');
      setBookingData(prev => ({ ...prev, candidate_id: client.id }));
    }
    setPreSearchQuery('');
    setPreSearchResults([]);
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

      let selectedRunStartDate: string;
      let selectedRunEndDate: string;

      if (isOtherRun) {
        selectedRunStartDate = newRunData.start_date;
        selectedRunEndDate = newRunData.end_date || newRunData.start_date;
      } else {
        const selectedRun = courseRuns.find(r => r.id === courseRunId);
        if (selectedRun) {
          selectedRunStartDate = selectedRun.start_date;
          selectedRunEndDate = selectedRun.end_date;
        } else {
          const { data: runData } = await supabase
            .from('course_runs')
            .select('start_date, end_date')
            .eq('id', courseRunId)
            .maybeSingle();
          selectedRunStartDate = runData?.start_date;
          selectedRunEndDate = runData?.end_date;
        }
      }

      if (candidateId && selectedRunStartDate && selectedRunEndDate && !confirmedOverlap) {
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select(`
            id,
            status,
            course_run_id,
            course_runs(start_date, end_date, courses(title))
          `)
          .eq('candidate_id', candidateId)
          .neq('status', 'cancelled');

        if (existingBookings && existingBookings.length > 0) {
          const newStart = new Date(selectedRunStartDate);
          const newEnd = new Date(selectedRunEndDate);

          for (const booking of existingBookings) {
            const run = booking.course_runs as any;
            if (!run?.start_date || !run?.end_date) continue;

            const existingStart = new Date(run.start_date);
            const existingEnd = new Date(run.end_date);

            const hasOverlap = newStart <= existingEnd && newEnd >= existingStart;

            if (hasOverlap) {
              const courseName = run.courses?.title || 'another course';
              const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              setOverlapWarning(
                `This candidate is already booked on "${courseName}" (${formatDate(existingStart)} - ${formatDate(existingEnd)}). Dates overlap with the selected course.`
              );
              setLoading(false);
              return;
            }
          }
        }
      }

      const netAmount = parseFloat(bookingData.amount) || 0;
      const vatAmount = bookingData.vat_exempt ? 0 : netAmount * 0.20;

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            contact_id: contactId,
            company_id: companyId,
            candidate_id: candidateId,
            course_run_id: courseRunId,
            status: bookingData.status,
            amount: netAmount,
            net_amount: netAmount,
            vat_amount: vatAmount,
            vat_exempt: bookingData.vat_exempt,
            payment_link: bookingData.payment_link || null,
            invoice_no: bookingData.invoice_no || null,
            certificate_no: bookingData.certificate_no || null,
            lead_id: prefillData?.leadId || null,
            invoice_sent: prefillData?.invoiceSent || false,
            start_time: bookingData.start_time || '08:00',
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
      vat_exempt: false,
      payment_link: '',
      start_time: '08:00',
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
    setOverlapWarning(null);
    setConfirmedOverlap(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
          <DialogDescription>Create a new course booking</DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4 text-slate-600" />
            <Label className="text-sm font-medium">Quick Search</Label>
          </div>
          <Input
            placeholder="Search by name or email to find existing clients..."
            value={preSearchQuery}
            onChange={(e) => setPreSearchQuery(e.target.value)}
            className="mb-2"
          />
          {preSearchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto mt-2">
              {preSearchResults.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="flex items-center justify-between p-2 bg-white rounded border hover:border-slate-400 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {result.first_name} {result.last_name}
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {result.type === 'contact' ? 'Contact' : 'Candidate'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {result.email && `${result.email}`}
                      {result.phone && ` • ${result.phone}`}
                      {result.companies?.name && ` • ${result.companies.name}`}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => useExistingClient(result)}
                  >
                    Use This Client
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

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
                    <Label>Company (optional)</Label>
                    <Combobox
                      options={[
                        { value: 'all', label: 'All Contacts' },
                        ...companies.map(company => ({
                          value: company.id,
                          label: company.name,
                        }))
                      ]}
                      value={bookingData.company_id}
                      onValueChange={(value) => setBookingData({ ...bookingData, company_id: value, contact_id: '' })}
                      placeholder="Filter by company or view all..."
                      searchPlaceholder="Type to search companies..."
                      emptyMessage="No companies found."
                    />
                    <p className="text-xs text-slate-600">
                      Optional: Filter contacts by company
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Contact *</Label>
                    <Combobox
                      options={(bookingData.company_id && bookingData.company_id !== 'all' ? filteredContacts : contacts).map(contact => ({
                        value: contact.id,
                        label: `${contact.first_name} ${contact.last_name}`,
                        secondary: contact.email || undefined,
                        tertiary: contact.phone || contact.companies?.name || undefined,
                      }))}
                      value={bookingData.contact_id}
                      onValueChange={(value) => setBookingData({ ...bookingData, contact_id: value })}
                      placeholder="Search and select contact..."
                      searchPlaceholder="Type to search contacts..."
                      emptyMessage="No contacts found."
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Candidate *</Label>
                  <Combobox
                    options={candidates.map(candidate => ({
                      value: candidate.id,
                      label: `${candidate.first_name} ${candidate.last_name}`,
                      secondary: candidate.email || undefined,
                      tertiary: candidate.phone || undefined,
                    }))}
                    value={bookingData.candidate_id}
                    onValueChange={(value) => setBookingData({ ...bookingData, candidate_id: value })}
                    placeholder="Search and select candidate..."
                    searchPlaceholder="Type to search candidates..."
                    emptyMessage="No candidates found."
                  />
                  <p className="text-xs text-slate-600">
                    Select from existing candidates in the system
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-4 mt-4">
              {duplicateWarnings.length > 0 && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm">
                    <div className="font-medium text-amber-900 mb-2">
                      Potential duplicate clients found ({duplicateWarnings.length})
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {duplicateWarnings.map((duplicate) => (
                        <div
                          key={`${duplicate.type}-${duplicate.id}`}
                          className="flex items-center justify-between p-2 bg-white rounded border text-slate-900"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {duplicate.first_name} {duplicate.last_name}
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                {duplicate.type === 'contact' ? 'Contact' : 'Candidate'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600">
                              {duplicate.email && `${duplicate.email}`}
                              {duplicate.phone && ` • ${duplicate.phone}`}
                              {duplicate.companies?.name && ` • ${duplicate.companies.name}`}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => useExistingClient(duplicate)}
                          >
                            Use This
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

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

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                <div>
                  <Label htmlFor="vat_exempt" className="font-medium">VAT Exempt (Dubai Account)</Label>
                  <p className="text-xs text-slate-500 mt-0.5">Enable for bookings through the Dubai account</p>
                </div>
                <Switch
                  id="vat_exempt"
                  checked={bookingData.vat_exempt}
                  onCheckedChange={(checked) => setBookingData({ ...bookingData, vat_exempt: checked })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Net Amount *</Label>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Select
                  value={bookingData.start_time}
                  onValueChange={(value) => setBookingData({ ...bookingData, start_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select start time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {startTimeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Course start time for joining instructions</p>
              </div>

              {bookingData.amount && (
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <div className="text-sm text-slate-600 mb-2">Price Breakdown</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Net Amount:</span>
                      <span className="font-medium">£{parseFloat(bookingData.amount).toFixed(2)}</span>
                    </div>
                    {!bookingData.vat_exempt && (
                      <div className="flex justify-between text-sm">
                        <span>VAT (20%):</span>
                        <span className="font-medium">£{(parseFloat(bookingData.amount) * 0.20).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                      <span>Total:</span>
                      <span>
                        £{bookingData.vat_exempt
                          ? parseFloat(bookingData.amount).toFixed(2)
                          : (parseFloat(bookingData.amount) * 1.20).toFixed(2)
                        }
                      </span>
                    </div>
                    {bookingData.vat_exempt && (
                      <div className="text-xs text-green-600 mt-1">VAT Exempt</div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="payment_link">Stripe Payment Link</Label>
                <Input
                  id="payment_link"
                  type="url"
                  placeholder="https://buy.stripe.com/..."
                  value={bookingData.payment_link}
                  onChange={(e) => setBookingData({ ...bookingData, payment_link: e.target.value })}
                />
                <p className="text-xs text-slate-500">Paste the payment link you created in Stripe</p>
              </div>
            </div>
          </div>

          {overlapWarning && (
            <Alert className="border-amber-500 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <span className="font-medium">Date Overlap Warning:</span> {overlapWarning}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            {overlapWarning && !confirmedOverlap ? (
              <Button
                type="button"
                variant="default"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  setConfirmedOverlap(true);
                  setOverlapWarning(null);
                }}
              >
                Proceed Anyway
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Booking'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
