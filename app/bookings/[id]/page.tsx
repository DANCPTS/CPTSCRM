'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CheckCircle, Calendar, Mail, Phone, Building2, User, FileText, Plus, Send, FileCheck, Download, Loader2 } from 'lucide-react';
import { BookingDialog } from '@/components/booking-dialog';
import { CelebrationAnimation } from '@/components/celebration-animation';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

export default function BookingFormDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingFormId = params.id as string;

  const [bookingForm, setBookingForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceChecked, setInvoiceChecked] = useState(false);
  const [bypassInvoice, setBypassInvoice] = useState(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [paymentType, setPaymentType] = useState<'invoice' | 'stripe'>('invoice');
  const [paymentLink, setPaymentLink] = useState('');
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  const [multiCourseDialogOpen, setMultiCourseDialogOpen] = useState(false);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState<number | null>(null);
  const [createdBookings, setCreatedBookings] = useState<Record<string, boolean>>({});
  const [bookingWasCreated, setBookingWasCreated] = useState(false);
  const [delegates, setDelegates] = useState<any[]>([]);
  const [delegateCourseMap, setDelegateCourseMap] = useState<Record<string, string[]>>({});
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    loadBookingForm();

    const subscription = supabase
      .channel('booking_form_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'booking_forms',
          filter: `id=eq.${bookingFormId}`,
        },
        (payload) => {
          const newData = payload.new;
          if (newData.status === 'signed' && bookingForm?.status !== 'signed') {
            setShowCelebration(true);
          }
          loadBookingForm();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [bookingFormId]);

  const loadBookingForm = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_forms')
        .select(`
          *,
          leads(*),
          booking_form_courses(*)
        `)
        .eq('id', bookingFormId)
        .maybeSingle();

      if (error) throw error;

      setBookingForm(data);

      // Load delegates and their course assignments
      const { data: delegatesData, error: delegatesError } = await supabase
        .from('booking_form_delegates')
        .select('*')
        .eq('booking_form_id', bookingFormId)
        .order('created_at');

      if (delegatesError) throw delegatesError;
      setDelegates(delegatesData || []);

      // Load delegate-course mappings
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('booking_form_delegate_courses')
        .select(`
          delegate_id,
          course_id,
          booking_form_courses(id, course_name)
        `)
        .eq('booking_form_id', bookingFormId);

      if (mappingsError) throw mappingsError;

      // Build a map of delegate_id to array of course names
      const map: Record<string, string[]> = {};
      mappingsData?.forEach((mapping: any) => {
        if (!map[mapping.delegate_id]) {
          map[mapping.delegate_id] = [];
        }
        map[mapping.delegate_id].push(mapping.booking_form_courses?.course_name || 'Unknown Course');
      });
      setDelegateCourseMap(map);

      setInvoiceSent(data?.invoice_sent || false);
      setInvoiceNumber(data?.invoice_number || '');
      setInvoiceChecked(data?.invoice_sent || false);
      setPaymentType(data?.payment_type || 'invoice');
      setPaymentLink(data?.payment_link || '');

      if (data?.lead_id && data?.booking_form_courses?.length > 0) {
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select(`
            id,
            course_run_id,
            course_runs(
              course_id,
              courses(title)
            )
          `)
          .eq('lead_id', data.lead_id)
          .neq('status', 'cancelled');

        if (existingBookings && existingBookings.length > 0) {
          const existingMap: Record<string, boolean> = {};

          for (const booking of existingBookings) {
            const courseTitle = (booking.course_runs as any)?.courses?.title;
            if (courseTitle) {
              const matchingCourse = data.booking_form_courses.find(
                (bfc: any) => bfc.course_name?.toLowerCase().includes(courseTitle.toLowerCase()) ||
                              courseTitle.toLowerCase().includes(bfc.course_name?.toLowerCase())
              );
              if (matchingCourse) {
                existingMap[matchingCourse.id] = true;
              }
            }
          }

          setCreatedBookings(prev => ({ ...prev, ...existingMap }));
        }
      }

      if (data?.form_data?.delegates && data.form_data.delegates.length > 0) {
        const delegate = data.form_data.delegates[0];
        const delegateName = delegate.name;

        if (delegateName) {
          const nameParts = delegateName.trim().split(' ');
          let firstName = nameParts[0];
          let lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          const { data: candidateData } = await supabase
            .from('candidates')
            .select('id')
            .ilike('first_name', firstName)
            .ilike('last_name', lastName)
            .eq('status', 'active')
            .maybeSingle();

          if (candidateData) {
            setCandidateId(candidateData.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load booking form:', error);
    } finally {
      setLoading(false);
    }
  };

  const resendBookingForm = async () => {
    if (!bookingForm || !bookingForm.leads) return;

    setResending(true);
    try {
      const formUrl = `${window.location.origin}/booking-form/${bookingForm.token}`;
      const lead = bookingForm.leads;

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
        toast.success(`Booking form resent to ${lead.email}`);
      } else {
        toast.error('Failed to resend email: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to resend email:', error);
      toast.error('Failed to resend email. Check console for details.');
    } finally {
      setResending(false);
    }
  };

  const downloadSignedForm = async () => {
    setDownloadingPdf(true);

    try {
      const formData = bookingForm.form_data || {};
      const lead = bookingForm.leads;
      const delegatesToDisplay = delegates.length > 0 ? delegates : formData.delegates;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let y = 20;

      const addNewPageIfNeeded = (neededSpace: number) => {
        if (y + neededSpace > 280) {
          doc.addPage();
          y = 20;
        }
      };

      const drawSectionHeader = (title: string) => {
        addNewPageIfNeeded(15);
        doc.setFontSize(14);
        doc.setTextColor(15, 61, 94);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, y);
        y += 2;
        doc.setDrawColor(242, 141, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + 60, y);
        y += 8;
      };

      const drawLabelValue = (label: string, value: string, x: number = margin) => {
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.text(label, x, y);
        y += 4;
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(value || 'N/A', contentWidth - (x - margin));
        doc.text(lines, x, y);
        y += (lines.length * 4) + 4;
      };

      doc.setFontSize(20);
      doc.setTextColor(15, 61, 94);
      doc.setFont('helvetica', 'bold');
      doc.text('CPTS Training - Booking Form', pageWidth / 2, y, { align: 'center' });
      y += 10;

      doc.setFontSize(11);
      if (bookingForm.status === 'signed') {
        doc.setTextColor(22, 101, 52);
        doc.text('STATUS: SIGNED', pageWidth / 2, y, { align: 'center' });
      } else {
        doc.setTextColor(146, 64, 14);
        doc.text(`STATUS: ${bookingForm.status.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
      }
      y += 8;

      if (bookingForm.booking_reference) {
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Booking Reference: ${bookingForm.booking_reference}`, pageWidth / 2, y, { align: 'center' });
        y += 8;
      }
      y += 2;

      drawSectionHeader('Contact Information');

      if (formData.customer_type === 'business' && formData.company_name) {
        drawLabelValue('Company Name', formData.company_name);
      }
      drawLabelValue('Contact Name', formData.contact_name || lead?.name || 'N/A');
      drawLabelValue('Email', formData.contact_email || lead?.email || 'N/A');
      drawLabelValue('Phone', formData.contact_phone || lead?.phone || 'N/A');
      if (formData.address) {
        const fullAddress = `${formData.address}${formData.city ? ', ' + formData.city : ''}${formData.postcode ? ' ' + formData.postcode : ''}`;
        drawLabelValue('Address', fullAddress);
      }
      y += 5;

      drawSectionHeader('Course Details');

      const courses = bookingForm.booking_form_courses && bookingForm.booking_form_courses.length > 0
        ? bookingForm.booking_form_courses
        : [{
            course_name: formData.course_name || lead?.quoted_course || 'N/A',
            course_dates: formData.course_dates || lead?.quoted_dates,
            course_venue: formData.course_venue || lead?.quoted_venue,
            number_of_delegates: formData.number_of_delegates || lead?.number_of_delegates,
            price: null,
            currency: 'GBP',
            vat_exempt: false
          }];

      courses.forEach((course: any, index: number) => {
        addNewPageIfNeeded(30);

        if (courses.length > 1) {
          doc.setFontSize(11);
          doc.setTextColor(15, 61, 94);
          doc.setFont('helvetica', 'bold');
          doc.text(`Course ${index + 1}`, margin, y);
          y += 6;
        }

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        const courseLines = doc.splitTextToSize(course.course_name || 'N/A', contentWidth);
        doc.text(courseLines, margin, y);
        y += (courseLines.length * 5) + 3;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        if (course.course_dates) {
          doc.setTextColor(100, 116, 139);
          doc.text('Dates: ', margin, y);
          doc.setTextColor(30, 41, 59);
          doc.text(course.course_dates, margin + 15, y);
          y += 5;
        }
        if (course.course_venue) {
          doc.setTextColor(100, 116, 139);
          doc.text('Venue: ', margin, y);
          doc.setTextColor(30, 41, 59);
          doc.text(course.course_venue, margin + 15, y);
          y += 5;
        }
        doc.setTextColor(100, 116, 139);
        doc.text('Delegates: ', margin, y);
        doc.setTextColor(30, 41, 59);
        doc.text(String(course.number_of_delegates || 'N/A'), margin + 22, y);
        y += 5;

        if (course.price) {
          doc.setTextColor(100, 116, 139);
          doc.text('Price: ', margin, y);
          doc.setTextColor(242, 141, 0);
          doc.setFont('helvetica', 'bold');
          doc.text(`${course.currency || 'GBP'} ${Number(course.price).toFixed(2)}${!course.vat_exempt ? ' + VAT' : ''}`, margin + 13, y);
          doc.setFont('helvetica', 'normal');
          y += 5;
        }
        y += 5;
      });

      if (formData.po_number) {
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.text('PO Number: ', margin, y);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.text(formData.po_number, margin + 25, y);
        y += 10;
      }

      if (delegatesToDisplay && delegatesToDisplay.length > 0) {
        drawSectionHeader('Delegate Details');

        delegatesToDisplay.forEach((delegate: any, index: number) => {
          addNewPageIfNeeded(35);

          doc.setFontSize(11);
          doc.setTextColor(15, 61, 94);
          doc.setFont('helvetica', 'bold');
          doc.text(delegate.name || `Delegate ${index + 1}`, margin, y);
          y += 6;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');

          if (delegate.email) {
            doc.setTextColor(100, 116, 139);
            doc.text('Email: ', margin, y);
            doc.setTextColor(30, 41, 59);
            doc.text(delegate.email, margin + 14, y);
            y += 5;
          }
          if (delegate.phone) {
            doc.setTextColor(100, 116, 139);
            doc.text('Phone: ', margin, y);
            doc.setTextColor(30, 41, 59);
            doc.text(delegate.phone, margin + 14, y);
            y += 5;
          }
          if (delegate.date_of_birth) {
            doc.setTextColor(100, 116, 139);
            doc.text('DOB: ', margin, y);
            doc.setTextColor(30, 41, 59);
            doc.text(delegate.date_of_birth, margin + 11, y);
            y += 5;
          }
          if (delegate.national_insurance) {
            doc.setTextColor(100, 116, 139);
            doc.text('NI Number: ', margin, y);
            doc.setTextColor(30, 41, 59);
            doc.text(delegate.national_insurance, margin + 22, y);
            y += 5;
          }
          if (delegate.address) {
            const delegateAddress = `${delegate.address}${delegate.city ? ', ' + delegate.city : ''}${delegate.postcode ? ' ' + delegate.postcode : ''}`;
            doc.setTextColor(100, 116, 139);
            doc.text('Address: ', margin, y);
            doc.setTextColor(30, 41, 59);
            const addrLines = doc.splitTextToSize(delegateAddress, contentWidth - 20);
            doc.text(addrLines, margin + 17, y);
            y += (addrLines.length * 4) + 2;
          }

          if (delegate.id && delegateCourseMap[delegate.id] && delegateCourseMap[delegate.id].length > 0) {
            y += 2;
            doc.setFillColor(219, 234, 254);
            doc.roundedRect(margin, y - 3, contentWidth, 12, 2, 2, 'F');
            doc.setFontSize(9);
            doc.setTextColor(30, 64, 175);
            doc.setFont('helvetica', 'bold');
            doc.text('Enrolled Courses:', margin + 3, y + 2);
            doc.setFont('helvetica', 'normal');
            doc.text(delegateCourseMap[delegate.id].join(', '), margin + 35, y + 2);
            y += 15;
          }
          y += 5;
        });
      }

      if (formData.special_requirements) {
        drawSectionHeader('Special Requirements');
        doc.setFontSize(10);
        doc.setTextColor(146, 64, 14);
        const reqLines = doc.splitTextToSize(formData.special_requirements, contentWidth);
        doc.text(reqLines, margin, y);
        y += (reqLines.length * 4) + 10;
      }

      drawSectionHeader('Terms Agreement');
      addNewPageIfNeeded(20);
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(margin, y - 3, contentWidth, 15, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      const termsText = 'The customer has read and agreed to the terms and conditions. They confirmed that the information provided is accurate and understand that this is a legally binding agreement.';
      const termsLines = doc.splitTextToSize(termsText, contentWidth - 6);
      doc.text(termsLines, margin + 3, y + 2);
      y += 20;

      if (bookingForm.signature_data) {
        drawSectionHeader('Signature');
        addNewPageIfNeeded(50);

        try {
          doc.addImage(bookingForm.signature_data, 'PNG', margin, y, 60, 25);
          y += 30;
        } catch (e) {
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text('[Signature on file]', margin, y);
          y += 10;
        }

        if (bookingForm.signed_at) {
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(`Signed on ${format(new Date(bookingForm.signed_at), 'PPpp')}`, margin, y);
          y += 10;
        }
      }

      addNewPageIfNeeded(25);
      y += 5;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Sent: ${bookingForm.sent_at ? format(new Date(bookingForm.sent_at), 'PP') : 'N/A'}`, margin, y);
      doc.text(`Signed: ${bookingForm.signed_at ? format(new Date(bookingForm.signed_at), 'PP') : 'Not signed'}`, pageWidth / 2, y, { align: 'center' });
      doc.text(`Generated: ${format(new Date(), 'PP')}`, pageWidth - margin, y, { align: 'right' });
      y += 8;

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('This is a digitally signed booking form from CPTS Training', pageWidth / 2, y, { align: 'center' });

      const fileName = `booking-form-${formData.contact_name || lead?.name || 'unknown'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading booking form...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!bookingForm) {
    return (
      <AppShell>
        <div className="p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg text-gray-600">Booking form not found</p>
              <Button onClick={() => router.push('/bookings')} className="mt-4">
                Back to Bookings
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const formData = bookingForm.form_data || {};
  const lead = bookingForm.leads;

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.push('/bookings')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Booking Form</h1>
              <p className="text-slate-600 mt-1">Submitted booking form details</p>
            </div>
            <div className="flex items-center gap-3">
              {bookingForm.status === 'signed' && (
                <Button
                  variant="outline"
                  onClick={downloadSignedForm}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={resendBookingForm}
                disabled={resending}
              >
                <Send className="mr-2 h-4 w-4" />
                {resending ? 'Sending...' : 'Resend Form'}
              </Button>
              {bookingForm.status === 'signed' && (() => {
                const invoiceSubmitted = bookingForm.invoice_sent === true || (bookingForm.invoice_number && bookingForm.invoice_number.trim() !== '');

                if (!invoiceSubmitted) {
                  return (
                    <Button onClick={() => {
                      setInvoiceNumber('');
                      setInvoiceChecked(false);
                      setBypassInvoice(false);
                      setInvoiceDialogOpen(true);
                    }} variant="default">
                      <FileCheck className="mr-2 h-4 w-4" />
                      Send Invoice
                    </Button>
                  );
                }

                const hasCourses = bookingForm.booking_form_courses && bookingForm.booking_form_courses.length > 0;
                const hasMultipleCourses = hasCourses && bookingForm.booking_form_courses.length > 1;

                if (hasMultipleCourses) {
                  return (
                    <Button onClick={() => setMultiCourseDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Bookings ({bookingForm.booking_form_courses.length} courses)
                    </Button>
                  );
                }

                return (
                  <Button onClick={() => {
                    setSelectedCourseIndex(null);
                    setBookingDialogOpen(true);
                  }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Booking
                  </Button>
                );
              })()}
              <Badge
                variant={bookingForm.status === 'signed' ? 'default' : 'secondary'}
                className="text-sm px-3 py-1"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                {bookingForm.status === 'signed' ? 'Signed' : bookingForm.status}
              </Badge>
              {bookingForm.booking_reference && (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  <FileText className="mr-1 h-3 w-3" />
                  Ref: {bookingForm.booking_reference}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.customer_type === 'business' && formData.company_name && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Building2 className="h-4 w-4" />
                    Company Name
                  </div>
                  <p className="font-medium text-slate-900">{formData.company_name}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <User className="h-4 w-4" />
                  Contact Name
                </div>
                <p className="font-medium text-slate-900">{formData.contact_name || lead?.name || 'N/A'}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
                <p className="font-medium text-slate-900">{formData.contact_email || lead?.email || 'N/A'}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
                <p className="font-medium text-slate-900">{formData.contact_phone || lead?.phone || 'N/A'}</p>
              </div>

              {formData.address && (
                <div>
                  <div className="text-sm text-slate-500 mb-1">Address</div>
                  <p className="font-medium text-slate-900">{formData.address}</p>
                  {formData.postcode && (
                    <p className="font-medium text-slate-900 mt-1">{formData.postcode}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Course Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {bookingForm.booking_form_courses && bookingForm.booking_form_courses.length > 0 ? (
                bookingForm.booking_form_courses.map((course: any, index: number) => (
                  <div key={course.id} className={index > 0 ? 'pt-6 border-t' : ''}>
                    {bookingForm.booking_form_courses.length > 1 && (
                      <h4 className="font-semibold text-slate-900 mb-3">Course {index + 1}</h4>
                    )}
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm text-slate-500 mb-1">Course Name</div>
                        <p className="font-medium text-slate-900">{course.course_name}</p>
                      </div>

                      {course.course_dates && (
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Course Dates</div>
                          <p className="font-medium text-slate-900">{course.course_dates}</p>
                        </div>
                      )}

                      {course.course_venue && (
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Venue</div>
                          <p className="font-medium text-slate-900">{course.course_venue}</p>
                        </div>
                      )}

                      <div>
                        <div className="text-sm text-slate-500 mb-1">Number of Delegates</div>
                        <p className="font-medium text-slate-900">{course.number_of_delegates || 'N/A'}</p>
                      </div>

                      {course.price && (
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Price</div>
                          <p className="font-medium text-slate-900">{course.currency || 'GBP'} {Number(course.price).toFixed(2)} + VAT</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">Course Name</div>
                    <p className="font-medium text-slate-900">{formData.course_name || lead?.quoted_course || 'N/A'}</p>
                  </div>

                  <div>
                    <div className="text-sm text-slate-500 mb-1">Course Dates</div>
                    <p className="font-medium text-slate-900">{formData.course_dates || lead?.quoted_dates || 'N/A'}</p>
                  </div>

                  <div>
                    <div className="text-sm text-slate-500 mb-1">Venue</div>
                    <p className="font-medium text-slate-900">{formData.course_venue || lead?.quoted_venue || 'N/A'}</p>
                  </div>

                  <div>
                    <div className="text-sm text-slate-500 mb-1">Number of Delegates</div>
                    <p className="font-medium text-slate-900">{formData.number_of_delegates || lead?.number_of_delegates || 'N/A'}</p>
                  </div>
                </div>
              )}

              {formData.po_number && (
                <div className="pt-4 border-t">
                  <div className="text-sm text-slate-500 mb-1">PO Number</div>
                  <p className="font-medium text-slate-900">{formData.po_number}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(delegates.length > 0 || (formData.delegates && formData.delegates.length > 0)) && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Delegate Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {delegates.length > 0 ? (
                    delegates.map((delegate: any, index: number) => (
                      <div key={delegate.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <h4 className="font-semibold text-slate-900 mb-3">
                          {delegate.name || `Delegate ${index + 1}`}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {delegate.name && (
                            <div>
                              <div className="text-sm text-slate-500">Name</div>
                              <p className="font-medium text-slate-900">{delegate.name}</p>
                            </div>
                          )}
                          {delegate.email && (
                            <div>
                              <div className="text-sm text-slate-500">Email</div>
                              <p className="font-medium text-slate-900">{delegate.email}</p>
                            </div>
                          )}
                          {delegate.phone && (
                            <div>
                              <div className="text-sm text-slate-500">Phone</div>
                              <p className="font-medium text-slate-900">{delegate.phone}</p>
                            </div>
                          )}
                          {delegate.date_of_birth && (
                            <div>
                              <div className="text-sm text-slate-500">Date of Birth</div>
                              <p className="font-medium text-slate-900">{delegate.date_of_birth}</p>
                            </div>
                          )}
                          {delegate.national_insurance && (
                            <div>
                              <div className="text-sm text-slate-500">National Insurance Number</div>
                              <p className="font-medium text-slate-900">{delegate.national_insurance}</p>
                            </div>
                          )}
                          {delegate.address && (
                            <div>
                              <div className="text-sm text-slate-500">Address</div>
                              <p className="font-medium text-slate-900">{delegate.address}</p>
                              {delegate.postcode && (
                                <p className="font-medium text-slate-900 mt-1">{delegate.postcode}</p>
                              )}
                            </div>
                          )}
                        </div>
                        {delegateCourseMap[delegate.id] && delegateCourseMap[delegate.id].length > 0 && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-sm font-medium text-blue-900 mb-2">Enrolled Courses:</div>
                            <ul className="list-disc list-inside space-y-1">
                              {delegateCourseMap[delegate.id].map((courseName: string, idx: number) => (
                                <li key={idx} className="text-sm text-blue-800">{courseName}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    formData.delegates.map((delegate: any, index: number) => (
                      <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                        <h4 className="font-semibold text-slate-900 mb-3">
                          Delegate {formData.delegates.length > 1 ? index + 1 : ''}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {delegate.name && (
                            <div>
                              <div className="text-sm text-slate-500">Name</div>
                              <p className="font-medium text-slate-900">{delegate.name}</p>
                            </div>
                          )}
                          {delegate.date_of_birth && (
                            <div>
                              <div className="text-sm text-slate-500">Date of Birth</div>
                              <p className="font-medium text-slate-900">{delegate.date_of_birth}</p>
                            </div>
                          )}
                          {delegate.national_insurance && (
                            <div>
                              <div className="text-sm text-slate-500">National Insurance Number</div>
                              <p className="font-medium text-slate-900">{delegate.national_insurance}</p>
                            </div>
                          )}
                          {delegate.address && (
                            <div>
                              <div className="text-sm text-slate-500">Address</div>
                              <p className="font-medium text-slate-900">{delegate.address}</p>
                              {delegate.postcode && (
                                <p className="font-medium text-slate-900 mt-1">{delegate.postcode}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {formData.delegate_names && !formData.delegates && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Delegate Names
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap font-medium text-slate-900">{formData.delegate_names}</p>
              </CardContent>
            </Card>
          )}

          {formData.special_requirements && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Special Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap font-medium text-slate-900">{formData.special_requirements}</p>
              </CardContent>
            </Card>
          )}

          {bookingForm.signature_data && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Signature</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-white">
                  <img
                    src={bookingForm.signature_data}
                    alt="Signature"
                    className="max-w-full h-auto"
                  />
                </div>
                {bookingForm.signed_at && (
                  <p className="text-sm text-slate-500 mt-2">
                    Signed on {format(new Date(bookingForm.signed_at), 'PPpp')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Form Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">Status</div>
                <Badge variant={bookingForm.status === 'signed' ? 'default' : 'secondary'}>
                  {bookingForm.status}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Sent</div>
                <p className="font-medium text-slate-900">
                  {bookingForm.sent_at ? format(new Date(bookingForm.sent_at), 'PP') : 'N/A'}
                </p>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Signed</div>
                <p className="font-medium text-slate-900">
                  {bookingForm.signed_at ? format(new Date(bookingForm.signed_at), 'PP') : 'Not signed'}
                </p>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Expires</div>
                <p className="font-medium text-slate-900">
                  {bookingForm.expires_at ? format(new Date(bookingForm.expires_at), 'PP') : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('invoice')}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  paymentType === 'invoice'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-medium">Traditional Invoice</div>
                <div className="text-xs text-slate-500">Enter invoice number</div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('stripe')}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  paymentType === 'stripe'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-medium">Stripe Payment</div>
                <div className="text-xs text-slate-500">Send payment link</div>
              </button>
            </div>

            {paymentType === 'invoice' ? (
              <>
                <div>
                  <Label htmlFor="invoice-number">Invoice Number</Label>
                  <Input
                    id="invoice-number"
                    placeholder="Enter invoice number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    disabled={bypassInvoice}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="invoice-sent"
                    checked={invoiceChecked}
                    onCheckedChange={(checked) => setInvoiceChecked(checked as boolean)}
                    disabled={bypassInvoice}
                  />
                  <Label htmlFor="invoice-sent" className={bypassInvoice ? "opacity-50" : "cursor-pointer"}>
                    Invoice has been sent to the client
                  </Label>
                </div>
                <div className="border-t pt-4">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      id="bypass-invoice"
                      checked={bypassInvoice}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setBypassInvoice(newValue);
                        if (newValue) {
                          setInvoiceNumber('');
                          setInvoiceChecked(false);
                        }
                      }}
                      className="h-4 w-4 mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        Client will be invoiced later
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Invoice when course starts or at a later date
                      </p>
                    </div>
                  </label>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="payment-link">Stripe Payment Link</Label>
                  <Input
                    id="payment-link"
                    placeholder="https://buy.stripe.com/..."
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Paste the Stripe payment link from your dashboard
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">
                    <strong>Client:</strong> {formData.contact_name || lead?.name}
                  </div>
                  <div className="text-sm text-slate-600">
                    <strong>Email:</strong> {formData.contact_email || lead?.email}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
              Cancel
            </Button>
            {paymentType === 'invoice' ? (
              <Button
                onClick={async () => {
                  if (!bypassInvoice) {
                    if (!invoiceNumber?.trim()) {
                      toast.error('Please enter an invoice number');
                      return;
                    }
                    if (!invoiceChecked) {
                      toast.error('Please confirm the invoice has been sent');
                      return;
                    }
                  }

                  setSavingInvoice(true);
                  try {
                    const updateData = {
                      invoice_sent: bypassInvoice ? true : invoiceChecked,
                      invoice_number: bypassInvoice ? 'DEFERRED' : invoiceNumber.trim(),
                      payment_type: 'invoice',
                    };

                    const { error } = await supabase
                      .from('booking_forms')
                      .update(updateData)
                      .eq('id', bookingFormId)
                      .select();

                    if (error) throw error;

                    setBookingForm((prev: any) => ({ ...prev, ...updateData }));
                    setInvoiceSent(updateData.invoice_sent);
                    setInvoiceNumber(updateData.invoice_number);
                    setInvoiceDialogOpen(false);
                    setBypassInvoice(false);
                    setInvoiceChecked(false);

                    toast.success(bypassInvoice ? 'Invoice deferred. You can now create the booking.' : 'Invoice details saved!');
                    await loadBookingForm();
                  } catch (error: any) {
                    console.error('Failed to save invoice:', error);
                    toast.error('Failed to save invoice details');
                  } finally {
                    setSavingInvoice(false);
                  }
                }}
                disabled={savingInvoice}
              >
                {savingInvoice ? 'Saving...' : (bypassInvoice ? 'Defer Invoice' : 'Save Invoice Details')}
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  if (!paymentLink?.trim()) {
                    toast.error('Please enter a payment link');
                    return;
                  }

                  if (!paymentLink.includes('stripe.com') && !paymentLink.includes('buy.stripe')) {
                    toast.error('Please enter a valid Stripe payment link');
                    return;
                  }

                  const clientEmail = formData.contact_email || lead?.email;
                  if (!clientEmail) {
                    toast.error('No email address found for client');
                    return;
                  }

                  setSendingPaymentLink(true);
                  try {
                    const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-payment-link`;
                    const response = await fetch(apiUrl, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        bookingFormId,
                        clientName: formData.contact_name || lead?.name,
                        clientEmail,
                        paymentLink: paymentLink.trim(),
                        courses: bookingForm.booking_form_courses,
                      }),
                    });

                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Failed to send payment link');

                    const { error: updateError } = await supabase
                      .from('booking_forms')
                      .update({
                        payment_type: 'stripe',
                        payment_link: paymentLink.trim(),
                        payment_link_sent: true,
                        payment_link_sent_at: new Date().toISOString(),
                        invoice_sent: true,
                        invoice_number: 'STRIPE',
                      })
                      .eq('id', bookingFormId);

                    if (updateError) throw updateError;

                    setBookingForm((prev: any) => ({
                      ...prev,
                      payment_type: 'stripe',
                      payment_link: paymentLink.trim(),
                      payment_link_sent: true,
                      invoice_sent: true,
                      invoice_number: 'STRIPE',
                    }));

                    setInvoiceDialogOpen(false);
                    toast.success('Payment link sent to ' + clientEmail);
                    await loadBookingForm();
                  } catch (error: any) {
                    console.error('Failed to send payment link:', error);
                    toast.error(error.message || 'Failed to send payment link');
                  } finally {
                    setSendingPaymentLink(false);
                  }
                }}
                disabled={sendingPaymentLink}
              >
                {sendingPaymentLink ? 'Sending...' : 'Send Payment Link'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={multiCourseDialogOpen} onOpenChange={setMultiCourseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Bookings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This booking form includes {bookingForm?.booking_form_courses?.length || 0} courses. Create a booking for each course:
            </p>
            <div className="space-y-3">
              {bookingForm?.booking_form_courses?.map((course: any, index: number) => (
                <div
                  key={course.id}
                  className={`p-4 rounded-lg border-2 ${
                    createdBookings[course.id]
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{course.course_name}</h4>
                        {createdBookings[course.id] && (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Booking Created
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {course.course_dates && <span>{course.course_dates}</span>}
                        {course.course_venue && <span> - {course.course_venue}</span>}
                      </div>
                      <div className="text-sm text-slate-600">
                        {course.number_of_delegates} delegate(s) - {course.currency || 'GBP'} {Number(course.price).toFixed(2)} + VAT
                      </div>
                    </div>
                    {!createdBookings[course.id] && (
                      <Button
                        onClick={() => {
                          setSelectedCourseIndex(index);
                          setMultiCourseDialogOpen(false);
                          setBookingDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Booking
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {Object.keys(createdBookings).length === (bookingForm?.booking_form_courses?.length || 0) && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">All bookings have been created!</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMultiCourseDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookingDialog
        open={bookingDialogOpen}
        onClose={async () => {
          setBookingDialogOpen(false);
          if (bookingWasCreated && selectedCourseIndex !== null && bookingForm?.booking_form_courses?.[selectedCourseIndex]) {
            const courseId = bookingForm.booking_form_courses[selectedCourseIndex].id;
            setCreatedBookings(prev => ({ ...prev, [courseId]: true }));
            setMultiCourseDialogOpen(true);
          }
          setBookingWasCreated(false);
          await loadBookingForm();
        }}
        onSuccess={() => setBookingWasCreated(true)}
        prefillData={(() => {
          const selectedCourse = selectedCourseIndex !== null && bookingForm?.booking_form_courses?.[selectedCourseIndex]
            ? bookingForm.booking_form_courses[selectedCourseIndex]
            : null;

          const delegateEmail = formData.delegates && formData.delegates.length > 0 && formData.delegates[0].email
            ? formData.delegates[0].email
            : (formData.contact_email || lead?.email);

          return {
            leadId: bookingForm.lead_id,
            candidateId: candidateId || undefined,
            contactName: formData.delegates && formData.delegates.length > 0
              ? formData.delegates[0].name
              : (formData.contact_name || lead?.name),
            contactEmail: delegateEmail,
            contactPhone: formData.delegates && formData.delegates.length > 0 && formData.delegates[0].phone
              ? formData.delegates[0].phone
              : (formData.contact_phone || lead?.phone),
            companyName: formData.company_name || lead?.company_name,
            courseName: selectedCourse?.course_name || formData.course_name || lead?.quoted_course,
            courseDates: selectedCourse?.course_dates || formData.course_dates || lead?.quoted_dates,
            numberOfDelegates: selectedCourse?.number_of_delegates || formData.number_of_delegates || lead?.number_of_delegates,
            invoiceNumber: bookingForm.invoice_number,
            bookingReference: bookingForm.booking_reference || lead?.booking_reference,
          };
        })()}
      />

      <CelebrationAnimation
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </AppShell>
  );
}
