'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, LayoutList, LayoutGrid, Mail, Search, Send, Eye, Calendar, FileText, SendHorizontal, Users, Loader2, ExternalLink, ChevronDown } from 'lucide-react';
import { BookingDialog } from '@/components/booking-dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LeadDialog } from '@/components/lead-dialog';
import { CelebrationAnimation } from '@/components/celebration-animation';
import { InvoiceDialog } from '@/components/invoice-dialog';
import { useAuth } from '@/lib/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmailPreviewDialog } from '@/components/email-preview-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const statuses = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'qualified', label: 'Qualified', color: 'bg-green-100 text-green-800' },
  { value: 'proposal', label: 'Proposal', color: 'bg-purple-100 text-purple-800' },
  { value: 'won', label: 'Won', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
];

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingForms, setBookingForms] = useState<Record<string, any>>({});
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedLeadForBooking, setSelectedLeadForBooking] = useState<any>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [leadBookings, setLeadBookings] = useState<Record<string, any>>({});
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedLeadForInvoice, setSelectedLeadForInvoice] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewData, setEmailPreviewData] = useState<{
    recipientEmail: string;
    subject: string;
    htmlContent: string;
    emailType: 'booking-form' | 'joining-instructions';
    leadId: string;
  } | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const kanbanRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    if (userProfile) {
      loadUsers();
      setSelectedUserId(userProfile.id);
    }
  }, [userProfile]);

  useEffect(() => {
    const leadId = searchParams.get('id');
    if (leadId && leads.length > 0) {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setDialogOpen(true);
        router.replace('/leads');
      }
    }
  }, [searchParams, leads, router]);

  useEffect(() => {
    if (selectedUserId) {
      loadLeads();
      loadBookingForms();
      loadLeadBookings();
    }

    const leadSubscription = supabase
      .channel('lead_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          const updatedLead = payload.new;
          const oldLead = payload.old;

          if (oldLead.assigned_to !== updatedLead.assigned_to) {
            if (updatedLead.assigned_to !== selectedUserId) {
              setLeads(prevLeads => prevLeads.filter(lead => lead.id !== updatedLead.id));
            } else {
              loadLeads();
            }
          } else {
            setLeads(prevLeads =>
              prevLeads.map(lead =>
                lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead
              )
            );
          }

          if (updatedLead.status === 'won' && oldLead.status !== 'won') {
            setShowCelebration(true);
          }
        }
      )
      .subscribe();

    const bookingSubscription = supabase
      .channel('booking_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          loadLeadBookings();
        }
      )
      .subscribe();

    const bookingFormSubscription = supabase
      .channel('booking_form_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_forms',
        },
        () => {
          loadBookingForms();
        }
      )
      .subscribe();

    return () => {
      leadSubscription.unsubscribe();
      bookingSubscription.unsubscribe();
      bookingFormSubscription.unsubscribe();
    };
  }, [selectedUserId]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  };

  const loadLeads = async () => {
    try {
      let query = supabase
        .from('leads')
        .select('*, assigned_user:users!assigned_to(full_name)')
        .order('created_at', { ascending: false });

      if (selectedUserId) {
        query = query.eq('assigned_to', selectedUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out won/lost leads older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const filteredLeads = (data || []).filter(lead => {
        // Keep all leads that are not won or lost
        if (lead.status !== 'won' && lead.status !== 'lost') {
          return true;
        }

        // For won/lost leads, only show if closed within last 30 days or no closed_at set
        if (!lead.closed_at) {
          return true; // Keep if no closed_at (shouldn't happen but safe fallback)
        }

        const closedDate = new Date(lead.closed_at);
        return closedDate >= thirtyDaysAgo;
      });

      setLeads(filteredLeads);
    } catch (error: any) {
      toast.error('Failed to load leads');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookingForms = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_forms')
        .select('*, booking_form_courses(id), email_sent')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formsByLead: Record<string, any> = {};
      data?.forEach(form => {
        const existing = formsByLead[form.lead_id];
        if (!existing) {
          formsByLead[form.lead_id] = form;
        } else {
          // Prioritize signed forms over pending ones
          if (form.status === 'signed' && existing.status !== 'signed') {
            formsByLead[form.lead_id] = form;
          } else if (form.status === existing.status && new Date(form.created_at) > new Date(existing.created_at)) {
            // If same status, use the newer one
            formsByLead[form.lead_id] = form;
          }
        }
      });

      setBookingForms(formsByLead);
    } catch (error: any) {
      console.error('Failed to load booking forms:', error);
    }
  };

  const loadLeadBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, lead_id, invoice_sent, invoice_no, joining_instructions_sent, status')
        .neq('status', 'cancelled');

      if (error) throw error;

      const bookingsByLead: Record<string, any> = {};
      data?.forEach(booking => {
        if (booking.lead_id) {
          if (!bookingsByLead[booking.lead_id]) {
            bookingsByLead[booking.lead_id] = {
              ...booking,
              bookingCount: 1,
            };
          } else {
            bookingsByLead[booking.lead_id].bookingCount += 1;
            if (!bookingsByLead[booking.lead_id].invoice_no && booking.invoice_no) {
              bookingsByLead[booking.lead_id].invoice_no = booking.invoice_no;
            }
            if (!bookingsByLead[booking.lead_id].joining_instructions_sent && booking.joining_instructions_sent) {
              bookingsByLead[booking.lead_id].joining_instructions_sent = true;
            }
          }
        }
      });

      setLeadBookings(bookingsByLead);
    } catch (error: any) {
      console.error('Failed to load lead bookings:', error);
    }
  };

  const sendBookingForm = async (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: proposalCourses } = await supabase
        .from('proposal_courses')
        .select('*')
        .eq('lead_id', lead.id)
        .order('display_order');

      const totalDelegates = proposalCourses?.reduce((sum, course) => sum + (course.number_of_delegates || 0), 0) || 0;
      const totalAmount = proposalCourses?.reduce((sum, course) => sum + (course.price || 0), 0) || 0;

      const { data, error } = await supabase
        .from('booking_forms')
        .insert({
          lead_id: lead.id,
          token,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
          total_delegates: totalDelegates,
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (error) throw error;

      if (proposalCourses && proposalCourses.length > 0) {
        const coursesToInsert = proposalCourses.map((course, index) => ({
          booking_form_id: data.id,
          course_name: course.course_name,
          course_dates: course.dates,
          course_venue: course.venue,
          number_of_delegates: course.number_of_delegates,
          price: course.price,
          currency: course.currency,
          display_order: index,
          vat_exempt: course.vat_exempt || false,
        }));

        const { error: coursesError } = await supabase
          .from('booking_form_courses')
          .insert(coursesToInsert);

        if (coursesError) {
          console.error('Error creating booking form courses:', coursesError);
        }
      }

      const formUrl = `${window.location.origin}/booking-form/${token}`;

      let emailSent = false;
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-booking-form`;
        const headers = {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            leadId: lead.id,
            leadName: lead.name,
            leadEmail: lead.email,
            formUrl,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          emailSent = true;
          await supabase
            .from('booking_forms')
            .update({ email_sent: true })
            .eq('id', data.id);
        } else {
          console.error('Failed to send email:', result.error || result.message);
          toast.error('Failed to send email: ' + (result.error || 'Unknown error'));
        }
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        toast.error('Failed to send email. Check console for details.');
      }

      await navigator.clipboard.writeText(formUrl);

      if (emailSent) {
        toast.success(`Email sent to ${lead.email} and link copied to clipboard!`);
      } else {
        toast.success('Booking form created and link copied to clipboard (email failed to send)');
      }

      await loadBookingForms();
    } catch (error: any) {
      toast.error('Failed to create booking form');
      console.error(error);
    }
  };

  const createAndPreviewBookingForm = async (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: proposalCourses } = await supabase
        .from('proposal_courses')
        .select('*')
        .eq('lead_id', lead.id)
        .order('display_order');

      const totalDelegates = proposalCourses?.reduce((sum, course) => sum + (course.number_of_delegates || 0), 0) || 0;
      const totalAmount = proposalCourses?.reduce((sum, course) => sum + (course.price || 0), 0) || 0;

      const { data, error } = await supabase
        .from('booking_forms')
        .insert({
          lead_id: lead.id,
          token,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
          total_delegates: totalDelegates,
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (error) throw error;

      if (proposalCourses && proposalCourses.length > 0) {
        const coursesToInsert = proposalCourses.map((course, index) => ({
          booking_form_id: data.id,
          course_name: course.course_name,
          course_dates: course.dates,
          course_venue: course.venue,
          number_of_delegates: course.number_of_delegates,
          price: course.price,
          currency: course.currency,
          display_order: index,
          vat_exempt: course.vat_exempt || false,
        }));

        const { error: coursesError } = await supabase
          .from('booking_form_courses')
          .insert(coursesToInsert);

        if (coursesError) {
          console.error('Error creating booking form courses:', coursesError);
        }
      }

      await loadBookingForms();
      toast.success('Booking form created - opening preview...');
      window.open(`/booking-form/${token}`, '_blank');
    } catch (error: any) {
      toast.error('Failed to create booking form');
      console.error(error);
    }
  };

  const viewBookingForm = (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const form = bookingForms[lead.id];
    if (form) {
      window.location.href = `/bookings/${form.id}`;
    }
  };

  const previewBookingFormAsCustomer = (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const form = bookingForms[lead.id];
    if (form?.token) {
      window.open(`/booking-form/${form.token}`, '_blank');
    } else {
      toast.error('No booking form found for this lead');
    }
  };

  const sendExistingBookingFormEmail = async (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const form = bookingForms[lead.id];
    if (!form?.token) {
      toast.error('No booking form found');
      return;
    }

    try {
      const formUrl = `${window.location.origin}/booking-form/${form.token}`;
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-booking-form`;
      const headers = {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: lead.email,
          formUrl,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        await supabase
          .from('booking_forms')
          .update({ email_sent: true })
          .eq('id', form.id);
        toast.success(`Email sent to ${lead.email}!`);
        await loadBookingForms();
      } else {
        toast.error('Failed to send email: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email');
    }
  };

  const openBookingDialog = async (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = window.confirm(
      "Do you want to create an invoice first?\n\n" +
      "Click 'OK' to create invoice first (recommended)\n" +
      "Click 'Cancel' to skip invoice and go directly to booking candidates"
    );

    if (result) {
      setSelectedLeadForInvoice(lead);
      setInvoiceDialogOpen(true);
    } else {
      setSelectedLeadForBooking(lead);
      setBookingDialogOpen(true);
    }
  };

  const handleInvoice = (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeadForInvoice(lead);
    setInvoiceDialogOpen(true);
  };

  const handleSendJoiningInstructions = async (lead: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-joining-instructions`;

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send joining instructions');
      }

      const { error } = await supabase
        .from('bookings')
        .update({ joining_instructions_sent: true })
        .eq('lead_id', lead.id);

      if (error) throw error;

      toast.success(result.message || 'Joining instructions sent successfully!');
      loadLeadBookings();
    } catch (error: any) {
      console.error('Failed to send joining instructions:', error);
      toast.error(error.message || 'Failed to send joining instructions');
    }
  };

  const handlePreviewBookingFormEmail = async (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmailPreviewLoading(true);

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/preview-booking-form-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: lead.email,
          baseUrl: window.location.origin,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate preview');
      }

      setEmailPreviewData({
        recipientEmail: result.recipientEmail,
        subject: result.subject,
        htmlContent: result.htmlContent,
        emailType: 'booking-form',
        leadId: lead.id,
      });
      setEmailPreviewOpen(true);
    } catch (error: any) {
      console.error('Failed to preview email:', error);
      toast.error(error.message || 'Failed to generate email preview');
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const handlePreviewJoiningInstructionsEmail = async (lead: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmailPreviewLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/preview-joining-instructions-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate preview');
      }

      setEmailPreviewData({
        recipientEmail: result.recipientEmail,
        subject: result.subject,
        htmlContent: result.htmlContent,
        emailType: 'joining-instructions',
        leadId: lead.id,
      });
      setEmailPreviewOpen(true);
    } catch (error: any) {
      console.error('Failed to preview email:', error);
      toast.error(error.message || 'Failed to generate email preview');
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const handleEmailPreviewSend = async (modifiedHtml: string, modifiedSubject: string) => {
    if (!emailPreviewData) return;

    setEmailSending(true);
    const lead = leads.find(l => l.id === emailPreviewData.leadId);

    try {
      if (emailPreviewData.emailType === 'booking-form') {
        if (!lead) throw new Error('Lead not found');
        await sendBookingFormDirectly(lead, modifiedHtml, modifiedSubject);
      } else {
        if (!lead) throw new Error('Lead not found');
        await sendJoiningInstructionsWithContent(lead, modifiedHtml, modifiedSubject);
      }
      setEmailPreviewOpen(false);
      setEmailPreviewData(null);
    } catch (error: any) {
      console.error('Failed to send email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const sendBookingFormDirectly = async (lead: any, customHtml?: string, customSubject?: string) => {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: proposalCourses } = await supabase
      .from('proposal_courses')
      .select('*')
      .eq('lead_id', lead.id)
      .order('display_order');

    const totalDelegates = proposalCourses?.reduce((sum, course) => sum + (course.number_of_delegates || 0), 0) || 0;
    const totalAmount = proposalCourses?.reduce((sum, course) => sum + (course.price || 0), 0) || 0;

    const { data, error } = await supabase
      .from('booking_forms')
      .insert({
        lead_id: lead.id,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        total_delegates: totalDelegates,
        total_amount: totalAmount,
      })
      .select()
      .single();

    if (error) throw error;

    if (proposalCourses && proposalCourses.length > 0) {
      const coursesToInsert = proposalCourses.map((course, index) => ({
        booking_form_id: data.id,
        course_name: course.course_name,
        course_dates: course.dates,
        course_venue: course.venue,
        number_of_delegates: course.number_of_delegates,
        price: course.price,
        currency: course.currency,
        display_order: index,
        vat_exempt: course.vat_exempt || false,
      }));

      await supabase.from('booking_form_courses').insert(coursesToInsert);
    }

    const formUrl = `${window.location.origin}/booking-form/${token}`;
    const finalHtml = customHtml ? customHtml.replace('[token]', token) : undefined;

    const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-booking-form`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        formUrl,
        customHtml: finalHtml,
        customSubject,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    await navigator.clipboard.writeText(formUrl);
    toast.success(`Email sent to ${lead.email} and link copied to clipboard!`);
    await loadBookingForms();
  };

  const sendJoiningInstructionsWithContent = async (lead: any, customHtml: string, customSubject: string) => {
    const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-joining-instructions`;
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadId: lead.id,
        customHtml,
        customSubject,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send joining instructions');
    }

    const { error } = await supabase
      .from('bookings')
      .update({ joining_instructions_sent: true })
      .eq('lead_id', lead.id);

    if (error) throw error;

    toast.success(result.message || 'Joining instructions sent successfully!');
    loadLeadBookings();
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const oldLead = leads.find(lead => lead.id === leadId);

      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;

      setLeads(leads.map(lead =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      ));

      if (newStatus === 'won' && oldLead?.status !== 'won') {
        setShowCelebration(true);

        setTimeout(() => {
          const result = window.confirm(
            `🎉 Congratulations on winning ${oldLead?.name}!\n\n` +
            "Would you like to create an invoice now?\n\n" +
            "Click 'OK' to create invoice\n" +
            "Click 'Cancel' to skip"
          );

          if (result) {
            setSelectedLeadForInvoice(oldLead);
            setInvoiceDialogOpen(true);
          }
        }, 2000);
      }

      toast.success('Lead status updated');
    } catch (error: any) {
      toast.error('Failed to update lead status');
      console.error(error);
    }
  };

  const handleEdit = (lead: any) => {
    setSelectedLead(lead);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedLead(null);
    loadLeads();
  };

  const filterLeads = (leadsToFilter: any[]) => {
    if (!searchQuery.trim()) return leadsToFilter;

    const query = searchQuery.toLowerCase();
    return leadsToFilter.filter(lead =>
      lead.name?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query) ||
      lead.company_name?.toLowerCase().includes(query) ||
      lead.notes?.toLowerCase().includes(query)
    );
  };

  const getLeadsByStatus = (status: string) => {
    return filterLeads(leads.filter(lead => lead.status === status));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!kanbanRef.current) return;
    if ((e.target as HTMLElement).closest('button, a, select, input')) return;

    setIsDragging(true);
    setStartX(e.pageX - kanbanRef.current.offsetLeft);
    setScrollLeft(kanbanRef.current.scrollLeft);
    kanbanRef.current.classList.remove('cursor-grab-custom');
    kanbanRef.current.classList.add('cursor-grabbing-custom');
    kanbanRef.current.style.userSelect = 'none';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (kanbanRef.current) {
      kanbanRef.current.classList.remove('cursor-grabbing-custom');
      kanbanRef.current.classList.add('cursor-grab-custom');
      kanbanRef.current.style.userSelect = 'auto';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !kanbanRef.current) return;
    e.preventDefault();
    const x = e.pageX - kanbanRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    kanbanRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (kanbanRef.current) {
        kanbanRef.current.classList.remove('cursor-grabbing-custom');
        kanbanRef.current.classList.add('cursor-grab-custom');
        kanbanRef.current.style.userSelect = 'auto';
      }
    }
  };

  const checkForNewEmails = async () => {
    setCheckingEmails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in to check emails');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/email-to-lead`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      console.log('Email check result:', result);

      if (result.success) {
        console.log('=== EMAIL CHECK RESULTS ===');
        console.log(`Total emails checked: ${result.allEmails?.length || 0}`);
        console.log(`Matching enquiries found: ${result.enquiryEmails?.length || 0}`);
        console.log(`New leads created: ${result.created || 0}`);
        console.log(`Already imported: ${result.skipped || 0}`);

        if (result.allEmails) {
          console.log('\n=== ALL EMAILS ===');
          result.allEmails.forEach((email: any, i: number) => {
            console.log(`${i + 1}. ${email.subject}`);
            console.log(`   From: ${email.from}`);
            console.log(`   Body Length: ${email.bodyLength || 'N/A'}`);
            console.log(`   Body Preview: ${email.bodyPreview || 'N/A'}`);
          });
        }

        if (result.enquiryEmails) {
          console.log('\n=== MATCHING ENQUIRIES ===');
          result.enquiryEmails.forEach((email: any, i: number) => {
            console.log(`${i + 1}. ${email.subject}`);
            console.log(`   From: ${email.from}`);
          });
        }

        if (result.created > 0) {
          toast.success(`Successfully created ${result.created} new lead(s) from emails`);
          loadLeads();
        } else if (result.skipped > 0) {
          toast.info(`${result.skipped} lead(s) already imported`);
        } else {
          toast.info('No new enquiry emails found');
        }

        if (result.skipped > 0 && result.created > 0) {
          toast.info(`${result.skipped} lead(s) already imported`);
        }

        if (result.errors > 0) {
          toast.warning(`${result.errors} email(s) had errors`);
          if (result.errorDetails && result.errorDetails.length > 0) {
            console.error('Error details:', result.errorDetails);
            result.errorDetails.forEach((err: any) => {
              toast.error(`${err.email}: ${err.error}`);
            });
          }
        }
      } else {
        toast.error(result.error || 'Failed to check emails');
      }
    } catch (error: any) {
      toast.error('Failed to check emails');
      console.error(error);
    } finally {
      setCheckingEmails(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Leads Pipeline</h1>
              <p className="text-slate-600 mt-1">
                {selectedUserId === userProfile?.id
                  ? 'Manage your sales leads'
                  : `Viewing ${allUsers.find(u => u.id === selectedUserId)?.full_name}'s pipeline`}
              </p>
            </div>
            <div className="flex gap-2">
            {userProfile?.role === 'admin' && (
              <div className="flex items-center gap-2 mr-4">
                <Users className="h-4 w-4 text-slate-600" />
                <Select
                  value={selectedUserId || undefined}
                  onValueChange={(value) => {
                    setSelectedUserId(value);
                    setLoading(true);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="mr-2 h-4 w-4" />
              List
            </Button>
            <Button
              variant="outline"
              onClick={checkForNewEmails}
              disabled={checkingEmails}
            >
              <Mail className="mr-2 h-4 w-4" />
              {checkingEmails ? 'Checking...' : 'Check Emails'}
            </Button>
            <Button onClick={() => {
              setSelectedLead(null);
              setDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search leads by name, email, phone, company, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : viewMode === 'kanban' ? (
          <div
            ref={kanbanRef}
            className="flex gap-4 overflow-x-auto pb-4 select-none cursor-grab-custom"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {statuses.map(status => {
              const statusLeads = getLeadsByStatus(status.value);
              return (
                <div key={status.value} className="flex-shrink-0 w-80">
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-slate-700">{status.label}</h3>
                      <Badge variant="secondary">{statusLeads.length}</Badge>
                    </div>
                  </div>
                  <div className="space-y-3 min-h-[200px] bg-slate-50 rounded-lg p-3">
                    {statusLeads.map(lead => (
                      <Card
                        key={lead.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleEdit(lead)}
                      >
                        <CardContent className="p-4">
                          <div className="mb-2">
                            <h4 className="font-semibold text-sm">{lead.name}</h4>
                            {lead.company_name && (
                              <p className="text-xs text-slate-600">{lead.company_name}</p>
                            )}
                          </div>
                          {lead.training_interest && lead.training_interest.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {lead.training_interest.slice(0, 2).map((interest: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {interest}
                                </Badge>
                              ))}
                              {lead.training_interest.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{lead.training_interest.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                            <span>{lead.assigned_user?.full_name || 'Unassigned'}</span>
                            <Badge variant="secondary" className="text-xs">
                              {lead.preferred_language}
                            </Badge>
                          </div>
                          {(status.value === 'proposal' || status.value === 'won') && (
                            <div className="mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                              {status.value === 'proposal' && (
                                bookingForms[lead.id] ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-600">Form Status:</span>
                                      <Badge variant={bookingForms[lead.id].status === 'signed' ? 'default' : 'secondary'} className="text-xs">
                                        {bookingForms[lead.id].status}
                                      </Badge>
                                    </div>
                                    {!bookingForms[lead.id].email_sent && bookingForms[lead.id].status === 'pending' && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-amber-600">Email not sent yet</span>
                                        <Button
                                          size="sm"
                                          className="text-xs h-6"
                                          onClick={(e) => sendExistingBookingFormEmail(lead, e)}
                                        >
                                          <Send className="mr-1 h-3 w-3" />
                                          Send Email
                                        </Button>
                                      </div>
                                    )}
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={(e) => viewBookingForm(lead, e)}
                                      >
                                        <Eye className="mr-1 h-3 w-3" />
                                        View
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={(e) => previewBookingFormAsCustomer(lead, e)}
                                      >
                                        <ExternalLink className="mr-1 h-3 w-3" />
                                        Preview
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-shrink-0 text-xs px-2"
                                      onClick={(e) => handlePreviewBookingFormEmail(lead, e)}
                                      disabled={emailPreviewLoading}
                                    >
                                      {emailPreviewLoading ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="flex-1 text-xs">
                                          <Send className="mr-1 h-3 w-3" />
                                          Booking Form
                                          <ChevronDown className="ml-1 h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => createAndPreviewBookingForm(lead, e as any)}>
                                          <ExternalLink className="mr-2 h-4 w-4" />
                                          Create & Preview
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => sendBookingForm(lead, e as any)}>
                                          <Send className="mr-2 h-4 w-4" />
                                          Send to Customer
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )
                              )}
                              {status.value === 'won' && (() => {
                                const bookingForm = bookingForms[lead.id];
                                const hasSignedForm = bookingForm?.status === 'signed';
                                const isDeferred = bookingForm?.invoice_number === 'DEFERRED';
                                const invoiceSubmitted = isDeferred || bookingForm?.invoice_sent === true || (bookingForm?.invoice_number && bookingForm?.invoice_number.trim() !== '' && bookingForm?.invoice_number !== 'DEFERRED');
                                const hasBooking = leadBookings[lead.id];
                                const hasInvoiceNo = hasBooking?.invoice_no && hasBooking.invoice_no.trim() !== '';
                                const joiningInstructionsSent = hasBooking?.joining_instructions_sent;
                                const courseCount = bookingForm?.booking_form_courses?.length || 1;
                                const bookingCount = hasBooking?.bookingCount || 0;
                                const allBookingsCreated = bookingCount >= courseCount;

                                // STEP 5: Final state - Booked On (joining instructions sent)
                                if (hasBooking && allBookingsCreated && joiningInstructionsSent) {
                                  return (
                                    <div className="space-y-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs bg-white hover:bg-slate-50"
                                        onClick={(e) => viewBookingForm(lead, e)}
                                      >
                                        <Eye className="mr-1 h-3 w-3" />
                                        Booked On
                                      </Button>
                                      <div className="text-xs text-slate-600 mb-1">
                                        Invoice: {hasBooking.invoice_no}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs"
                                        onClick={(e) => handleInvoice(lead, e)}
                                      >
                                        <FileText className="mr-1 h-3 w-3" />
                                        Update Invoice
                                      </Button>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-shrink-0 text-xs px-2"
                                          onClick={(e) => handlePreviewJoiningInstructionsEmail(lead, e)}
                                          disabled={emailPreviewLoading}
                                        >
                                          {emailPreviewLoading ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Eye className="h-3 w-3" />
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 text-xs"
                                          onClick={(e) => handleSendJoiningInstructions(lead, e)}
                                        >
                                          <SendHorizontal className="mr-1 h-3 w-3" />
                                          Resend Joining Instructions
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                }

                                // STEP 4: Send Joining Instructions (all bookings created, invoice number exists)
                                if (hasBooking && allBookingsCreated && hasInvoiceNo && !joiningInstructionsSent) {
                                  return (
                                    <div className="space-y-2">
                                      <div className="text-xs text-slate-600 mb-1">
                                        Invoice: {hasBooking.invoice_no}
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-shrink-0 text-xs px-2"
                                          onClick={(e) => handlePreviewJoiningInstructionsEmail(lead, e)}
                                          disabled={emailPreviewLoading}
                                        >
                                          {emailPreviewLoading ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Eye className="h-3 w-3" />
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="flex-1 text-xs"
                                          onClick={(e) => handleSendJoiningInstructions(lead, e)}
                                        >
                                          <SendHorizontal className="mr-1 h-3 w-3" />
                                          Send Joining Instructions
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                }

                                // STEP 3: Create Booking (form signed, invoice sent, not all bookings created yet)
                                if (hasSignedForm && invoiceSubmitted && !allBookingsCreated) {
                                  const remaining = courseCount - bookingCount;
                                  return (
                                    <Button
                                      size="sm"
                                      className="w-full text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/bookings/${bookingForm.id}`);
                                      }}
                                    >
                                      <Calendar className="mr-1 h-3 w-3" />
                                      {courseCount > 1
                                        ? `Create Bookings (${bookingCount}/${courseCount})`
                                        : 'Create Booking'}
                                    </Button>
                                  );
                                }

                                // STEP 2: Send Invoice (form signed, no invoice yet)
                                if (hasSignedForm && !invoiceSubmitted) {
                                  return (
                                    <div className="space-y-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full text-xs"
                                        onClick={(e) => viewBookingForm(lead, e)}
                                      >
                                        <Eye className="mr-1 h-3 w-3" />
                                        View Form
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="w-full text-xs"
                                        onClick={(e) => handleInvoice(lead, e)}
                                      >
                                        <FileText className="mr-1 h-3 w-3" />
                                        Send Invoice
                                      </Button>
                                    </div>
                                  );
                                }

                                // STEP 1: Need to send booking form first (or view if pending)
                                if (bookingForm && bookingForm.status === 'pending') {
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full text-xs"
                                      onClick={(e) => viewBookingForm(lead, e)}
                                    >
                                      <Eye className="mr-1 h-3 w-3" />
                                      View Form (Pending)
                                    </Button>
                                  );
                                }

                                // No booking form at all - need to send one
                                if (!bookingForm) {
                                  return (
                                    <Button
                                      size="sm"
                                      className="w-full text-xs"
                                      onClick={(e) => sendBookingForm(lead, e)}
                                    >
                                      <Send className="mr-1 h-3 w-3" />
                                      Send Booking Form
                                    </Button>
                                  );
                                }

                                return null;
                              })()}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filterLeads(leads).map(lead => (
              <Card
                key={lead.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => handleEdit(lead)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{lead.name}</h4>
                      <p className="text-sm text-slate-600">
                        {lead.company_name} • {lead.email} • {lead.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={statuses.find(s => s.value === lead.status)?.color}>
                        {statuses.find(s => s.value === lead.status)?.label}
                      </Badge>
                      <span className="text-sm text-slate-600">{lead.assigned_user?.full_name || 'Unassigned'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <LeadDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        lead={selectedLead}
      />

      <InvoiceDialog
        open={invoiceDialogOpen}
        onClose={async () => {
          setInvoiceDialogOpen(false);
          setSelectedLeadForInvoice(null);
          await Promise.all([loadLeadBookings(), loadBookingForms()]);
          setTimeout(() => {
            loadBookingForms();
          }, 500);
        }}
        leadId={selectedLeadForInvoice?.id}
        leadName={selectedLeadForInvoice?.name}
        leadEmail={selectedLeadForInvoice?.email}
      />

      <BookingDialog
        open={bookingDialogOpen}
        onClose={() => {
          setBookingDialogOpen(false);
          setSelectedLeadForBooking(null);
          loadLeadBookings();
        }}
        prefillData={selectedLeadForBooking ? {
          leadId: selectedLeadForBooking.id,
          contactName: selectedLeadForBooking.name,
          contactEmail: selectedLeadForBooking.email,
          contactPhone: selectedLeadForBooking.phone,
          companyName: selectedLeadForBooking.company_name,
          courseName: selectedLeadForBooking.quoted_course,
          courseDates: selectedLeadForBooking.quoted_dates,
          numberOfDelegates: selectedLeadForBooking.number_of_delegates,
          invoiceNumber: bookingForms[selectedLeadForBooking.id]?.invoice_number,
          invoiceSent: bookingForms[selectedLeadForBooking.id]?.invoice_sent,
        } : undefined}
      />

      <CelebrationAnimation
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />

      {emailPreviewData && (
        <EmailPreviewDialog
          open={emailPreviewOpen}
          onClose={() => {
            setEmailPreviewOpen(false);
            setEmailPreviewData(null);
          }}
          recipientEmail={emailPreviewData.recipientEmail}
          subject={emailPreviewData.subject}
          htmlContent={emailPreviewData.htmlContent}
          emailType={emailPreviewData.emailType}
          onSend={handleEmailPreviewSend}
          isSending={emailSending}
        />
      )}
    </AppShell>
  );
}
