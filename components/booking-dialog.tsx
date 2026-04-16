'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UserPlus, Users, User, TriangleAlert as AlertTriangle, Search, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface BookingDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  prefillData?: {
    leadId?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    companyName?: string;
    courseName?: string;
    courseDates?: string;
    courseVenue?: string;
    numberOfDelegates?: number;
    invoiceNumber?: string;
    invoiceSent?: boolean;
    candidateId?: string;
    bookingReference?: string;
    amount?: string;
  };
}

export function BookingDialog({ open, onClose, onSuccess, prefillData }: BookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
  const [isIndividual, setIsIndividual] = useState(false);
  const [bookingType, setBookingType] = useState<'company' | 'individual'>('company');
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<any[]>([]);
  const [preSearchQuery, setPreSearchQuery] = useState('');
  const [preSearchResults, setPreSearchResults] = useState<any[]>([]);
  const [hasAutoFilledFromLead, setHasAutoFilledFromLead] = useState(false);

  const [bookingData, setBookingData] = useState({
    contact_id: '',
    company_id: '',
    candidate_id: '',
    course_name: '',
    course_dates: '',
    course_venue: '',
    status: 'reserved',
    amount: '',
    invoice_no: '',
    certificate_no: '',
    vat_exempt: false,
    payment_link: '',
    start_time: '08:00',
    booking_reference: '',
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

  const prefillDataRef = useRef(prefillData);
  prefillDataRef.current = prefillData;

  useEffect(() => {
    if (open) {
      loadData();
      if (prefillDataRef.current) {
        prefillFormData();
      }
    }
  }, [open]);

  const prefillFormData = async () => {
    if (!prefillData) return;

    if (prefillData.courseName) {
      setBookingData(prev => ({ ...prev, course_name: prefillData.courseName || '' }));
    }
    if (prefillData.courseDates) {
      setBookingData(prev => ({ ...prev, course_dates: prefillData.courseDates || '' }));
    }
    if (prefillData.courseVenue) {
      setBookingData(prev => ({ ...prev, course_venue: prefillData.courseVenue || '' }));
    }
    if (prefillData.amount) {
      setBookingData(prev => ({ ...prev, amount: prefillData.amount || '' }));
    }
    if (prefillData.invoiceNumber) {
      setBookingData(prev => ({ ...prev, invoice_no: prefillData.invoiceNumber || '' }));
    }
    if (prefillData.bookingReference) {
      setBookingData(prev => ({ ...prev, booking_reference: prefillData.bookingReference || '' }));
    }

    if (prefillData.candidateId) {
      setBookingData(prev => ({ ...prev, candidate_id: prefillData.candidateId || '' }));
      setClientType('existing');
      setBookingType('individual');
      setHasAutoFilledFromLead(true);
      return;
    }

    let foundContact = false;
    let foundCompany = false;
    let companyId = '';

    if (prefillData.companyName) {
      const { data: matchingCompany } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${prefillData.companyName}%`)
        .limit(1)
        .maybeSingle();

      if (matchingCompany) {
        companyId = matchingCompany.id;
        foundCompany = true;
        setBookingData(prev => ({ ...prev, company_id: matchingCompany.id }));
      }
    }

    if (prefillData.contactEmail) {
      const { data: matchingContact } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_id')
        .ilike('email', prefillData.contactEmail)
        .limit(1)
        .maybeSingle();

      if (matchingContact) {
        foundContact = true;
        setClientType('existing');
        setBookingType('company');
        setHasAutoFilledFromLead(true);
        setBookingData(prev => ({
          ...prev,
          contact_id: matchingContact.id,
          company_id: matchingContact.company_id || companyId,
        }));

        if (!matchingContact.company_id && !companyId) {
          setBookingType('individual');
          const { data: matchingCandidate } = await supabase
            .from('candidates')
            .select('id')
            .ilike('email', prefillData.contactEmail!)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

          if (matchingCandidate) {
            setBookingData(prev => ({ ...prev, candidate_id: matchingCandidate.id }));
          }
        }
      }
    }

    if (!foundContact && prefillData.contactName) {
      const [firstName, ...lastNameParts] = prefillData.contactName.split(' ');
      const lastName = lastNameParts.join(' ');

      if (firstName && lastName) {
        const { data: matchingContact } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, company_id')
          .ilike('first_name', firstName)
          .ilike('last_name', lastName)
          .limit(1)
          .maybeSingle();

        if (matchingContact) {
          foundContact = true;
          setClientType('existing');
          setBookingType('company');
          setHasAutoFilledFromLead(true);
          setBookingData(prev => ({
            ...prev,
            contact_id: matchingContact.id,
            company_id: matchingContact.company_id || companyId,
          }));
        }
      }
    }

    if (!foundContact) {
      const [firstName, ...lastNameParts] = (prefillData.contactName || '').split(' ');
      const lastName = lastNameParts.join(' ');

      setClientType('new');
      setNewContactData({
        first_name: firstName || '',
        last_name: lastName || '',
        email: prefillData.contactEmail || '',
        phone: prefillData.contactPhone || '',
        language: 'EN',
        company_id: companyId || '',
      });

      if (prefillData.companyName && !foundCompany) {
        setIsIndividual(false);
        setNewCompanyData(prev => ({
          ...prev,
          name: prefillData.companyName || '',
        }));
      } else if (!prefillData.companyName) {
        setIsIndividual(true);
      } else {
        setIsIndividual(false);
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

  const loadData = async () => {
    try {
      const [companiesRes, contactsRes, candidatesRes] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('contacts').select('id, first_name, last_name, email, phone, company_id, companies(name)').order('last_name'),
        supabase.from('candidates').select('id, first_name, last_name, email, phone').eq('status', 'active').order('last_name'),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (candidatesRes.error) throw candidatesRes.error;

      setCompanies(companiesRes.data || []);
      setContacts(contactsRes.data || []);
      setCandidates(candidatesRes.data || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    }
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
      if (!bookingData.course_name) {
        toast.error('Please enter a course name');
        setLoading(false);
        return;
      }

      let contactId = bookingData.contact_id;
      let companyId: string | null = bookingData.company_id;

      if (clientType === 'existing' && bookingType === 'individual') {
        const resolvedCandidateId = bookingData.candidate_id || prefillData?.candidateId || '';
        if (!resolvedCandidateId) {
          toast.error('Please select a candidate');
          setLoading(false);
          return;
        }

        const { data: candidate } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', resolvedCandidateId)
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

      let candidateId = null;
      if (clientType === 'existing' && bookingType === 'individual') {
        candidateId = bookingData.candidate_id || prefillData?.candidateId || null;
      } else {
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

      const netAmount = parseFloat(bookingData.amount) || 0;
      const vatAmount = bookingData.vat_exempt ? 0 : netAmount * 0.20;

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            contact_id: contactId,
            company_id: companyId,
            candidate_id: candidateId,
            course_name: bookingData.course_name,
            course_dates: bookingData.course_dates || null,
            course_venue: bookingData.course_venue || null,
            course_run_id: null,
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
            booking_reference: bookingData.booking_reference || null,
          },
        ]);

      if (bookingError) throw bookingError;

      toast.success('Booking created successfully');
      onSuccess?.();
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
      course_name: '',
      course_dates: '',
      course_venue: '',
      status: 'reserved',
      amount: '',
      invoice_no: '',
      certificate_no: '',
      vat_exempt: false,
      payment_link: '',
      start_time: '08:00',
      booking_reference: '',
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
    setClientType('existing');
    setIsIndividual(false);
    setBookingType('company');
    setHasAutoFilledFromLead(false);
  };

  const renderClientSection = () => {
    if (hasAutoFilledFromLead) {
      return (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
            <Users className="h-4 w-4" />
            Client Details (Auto-filled)
          </div>
          <div className="text-sm text-green-700">
            {bookingType === 'company' ? (
              <>
                <p>
                  <span className="font-medium">Contact:</span>{' '}
                  {contacts.find(c => c.id === bookingData.contact_id)
                    ? `${contacts.find(c => c.id === bookingData.contact_id)?.first_name} ${contacts.find(c => c.id === bookingData.contact_id)?.last_name}`
                    : prefillData?.contactName || 'Loading...'}
                </p>
                {bookingData.company_id && (
                  <p>
                    <span className="font-medium">Company:</span>{' '}
                    {companies.find(c => c.id === bookingData.company_id)?.name || prefillData?.companyName || 'Loading...'}
                  </p>
                )}
              </>
            ) : (
              <p>
                <span className="font-medium">Candidate:</span>{' '}
                {candidates.find(c => c.id === bookingData.candidate_id)
                  ? `${candidates.find(c => c.id === bookingData.candidate_id)?.first_name} ${candidates.find(c => c.id === bookingData.candidate_id)?.last_name}`
                  : prefillData?.contactName || 'Loading...'}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="text-green-700 p-0 h-auto mt-2"
            onClick={() => setHasAutoFilledFromLead(false)}
          >
            Change client selection
          </Button>
        </div>
      );
    }

    return (
      <>
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
                      {result.phone && ` - ${result.phone}`}
                      {result.companies?.name && ` - ${result.companies.name}`}
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
                    setBookingData(prev => ({ ...prev, candidate_id: '', contact_id: '', company_id: '' }));
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
                    setBookingData(prev => ({ ...prev, candidate_id: '', contact_id: '', company_id: '' }));
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
                    onValueChange={(value) => setBookingData(prev => ({ ...prev, company_id: value, contact_id: '' }))}
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
                    onValueChange={(value) => setBookingData(prev => ({ ...prev, contact_id: value }))}
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
                  onValueChange={(value) => setBookingData(prev => ({ ...prev, candidate_id: value }))}
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
                            {duplicate.phone && ` - ${duplicate.phone}`}
                            {duplicate.companies?.name && ` - ${duplicate.companies.name}`}
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
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
          <DialogDescription>Create a new course booking</DialogDescription>
        </DialogHeader>

        {prefillData && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-amber-700 font-semibold mb-2">
              <Calendar className="h-4 w-4" />
              Booking Details
            </div>
            <div className="space-y-1">
              {prefillData.courseName ? (
                <div className="font-semibold text-amber-900">Course: {prefillData.courseName}</div>
              ) : (
                <div className="font-semibold text-amber-900">Course: Not specified - enter below</div>
              )}
              {prefillData.courseDates && (
                <div className="text-sm text-amber-800">Dates: {prefillData.courseDates}</div>
              )}
              {prefillData.contactName && (
                <div className="text-sm text-amber-800">Delegate: {prefillData.contactName}</div>
              )}
              {prefillData.companyName && (
                <div className="text-sm text-amber-800">Company: {prefillData.companyName}</div>
              )}
              {prefillData.invoiceNumber && (
                <div className="text-sm text-amber-800">Invoice: {prefillData.invoiceNumber}</div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {renderClientSection()}

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Course Details</h4>

            <div className="space-y-2">
              <Label htmlFor="course_name">Course Name *</Label>
              <Input
                id="course_name"
                value={bookingData.course_name}
                onChange={(e) => setBookingData(prev => ({ ...prev, course_name: e.target.value }))}
                placeholder="e.g., CPCS A17 Telehandler"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course_dates">Course Dates</Label>
                <Input
                  id="course_dates"
                  value={bookingData.course_dates}
                  onChange={(e) => setBookingData(prev => ({ ...prev, course_dates: e.target.value }))}
                  placeholder="e.g., 15-17 Jan 2025"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="course_venue">Venue / Location</Label>
                <Input
                  id="course_venue"
                  value={bookingData.course_venue}
                  onChange={(e) => setBookingData(prev => ({ ...prev, course_venue: e.target.value }))}
                  placeholder="e.g., Client Site, Birmingham"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium">Pricing & Status</h4>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
              <div>
                <Label htmlFor="vat_exempt" className="font-medium">VAT Exempt (Dubai Account)</Label>
                <p className="text-xs text-slate-500 mt-0.5">Enable for bookings through the Dubai account</p>
              </div>
              <Switch
                id="vat_exempt"
                checked={bookingData.vat_exempt}
                onCheckedChange={(checked) => setBookingData(prev => ({ ...prev, vat_exempt: checked }))}
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
                  onChange={(e) => setBookingData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={bookingData.status}
                  onValueChange={(value) => setBookingData(prev => ({ ...prev, status: value }))}
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
                onValueChange={(value) => setBookingData(prev => ({ ...prev, start_time: value }))}
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

            <div className="space-y-2">
              <Label htmlFor="booking_reference">Booking Reference</Label>
              <Input
                id="booking_reference"
                value={bookingData.booking_reference}
                onChange={(e) => setBookingData(prev => ({ ...prev, booking_reference: e.target.value }))}
                placeholder="e.g., ABC-001, PO12345"
              />
              <p className="text-xs text-slate-500">Your reference number for this booking</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_no">Invoice No</Label>
                <Input
                  id="invoice_no"
                  value={bookingData.invoice_no}
                  onChange={(e) => setBookingData(prev => ({ ...prev, invoice_no: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificate_no">Certificate No</Label>
                <Input
                  id="certificate_no"
                  value={bookingData.certificate_no}
                  onChange={(e) => setBookingData(prev => ({ ...prev, certificate_no: e.target.value }))}
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
                onChange={(e) => setBookingData(prev => ({ ...prev, payment_link: e.target.value }))}
              />
              <p className="text-xs text-slate-500">Paste the payment link you created in Stripe</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
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
