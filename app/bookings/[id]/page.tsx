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
import { ArrowLeft, CheckCircle, Calendar, Mail, Phone, Building2, User, FileText, Plus, Send, FileCheck, Download } from 'lucide-react';
import { BookingDialog } from '@/components/booking-dialog';
import { CelebrationAnimation } from '@/components/celebration-animation';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

      setInvoiceSent(data?.invoice_sent || false);
      setInvoiceNumber(data?.invoice_number || '');
      setInvoiceChecked(data?.invoice_sent || false);
      setPaymentType(data?.payment_type || 'invoice');
      setPaymentLink(data?.payment_link || '');

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

  const downloadSignedForm = () => {
    const formData = bookingForm.form_data || {};
    const lead = bookingForm.leads;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Booking Form - ${formData.contact_name || lead?.name || 'N/A'}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #475569; margin-top: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .section { margin-bottom: 30px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #64748b; font-size: 14px; margin-bottom: 4px; }
    .value { color: #1e293b; font-size: 16px; }
    .signature-box { border: 2px solid #e2e8f0; padding: 20px; margin-top: 20px; background: #f8fafc; }
    .signature-img { max-width: 100%; height: auto; border: 1px solid #cbd5e1; background: white; padding: 10px; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; }
    .status-signed { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Booking Form</h1>
  <div class="section">
    <span class="status-badge ${bookingForm.status === 'signed' ? 'status-signed' : 'status-pending'}">
      ${bookingForm.status === 'signed' ? '✓ Signed' : bookingForm.status}
    </span>
  </div>

  <h2>Contact Information</h2>
  <div class="section">
    ${formData.customer_type === 'business' && formData.company_name ? `
    <div class="field">
      <div class="label">Company Name</div>
      <div class="value">${formData.company_name}</div>
    </div>
    ` : ''}
    <div class="field">
      <div class="label">Contact Name</div>
      <div class="value">${formData.contact_name || lead?.name || 'N/A'}</div>
    </div>
    <div class="field">
      <div class="label">Email</div>
      <div class="value">${formData.contact_email || lead?.email || 'N/A'}</div>
    </div>
    <div class="field">
      <div class="label">Phone</div>
      <div class="value">${formData.contact_phone || lead?.phone || 'N/A'}</div>
    </div>
    ${formData.address ? `
    <div class="field">
      <div class="label">Address</div>
      <div class="value">${formData.address}${formData.postcode ? '<br>' + formData.postcode : ''}</div>
    </div>
    ` : ''}
  </div>

  <h2>Course Details</h2>
  ${bookingForm.booking_form_courses && bookingForm.booking_form_courses.length > 0 ?
    bookingForm.booking_form_courses.map((course: any, index: number) => `
      <div class="section" style="${index > 0 ? 'margin-top: 20px; padding-top: 20px; border-top: 2px solid #e2e8f0;' : ''}">
        ${bookingForm.booking_form_courses.length > 1 ? `<h3 style="margin-top: 0; color: #475569;">Course ${index + 1}</h3>` : ''}
        <div class="field">
          <div class="label">Course Name</div>
          <div class="value">${course.course_name}</div>
        </div>
        ${course.course_dates ? `
        <div class="field">
          <div class="label">Course Dates</div>
          <div class="value">${course.course_dates}</div>
        </div>
        ` : ''}
        ${course.course_venue ? `
        <div class="field">
          <div class="label">Venue</div>
          <div class="value">${course.course_venue}</div>
        </div>
        ` : ''}
        <div class="field">
          <div class="label">Number of Delegates</div>
          <div class="value">${course.number_of_delegates || 'N/A'}</div>
        </div>
        ${course.price ? `
        <div class="field">
          <div class="label">Price</div>
          <div class="value">${course.currency || 'GBP'} ${Number(course.price).toFixed(2)} + VAT</div>
        </div>
        ` : ''}
      </div>
    `).join('') : `
    <div class="section">
      <div class="field">
        <div class="label">Course Name</div>
        <div class="value">${formData.course_name || lead?.quoted_course || 'N/A'}</div>
      </div>
      <div class="field">
        <div class="label">Course Dates</div>
        <div class="value">${formData.course_dates || lead?.quoted_dates || 'N/A'}</div>
      </div>
      <div class="field">
        <div class="label">Venue</div>
        <div class="value">${formData.course_venue || lead?.quoted_venue || 'N/A'}</div>
      </div>
      <div class="field">
        <div class="label">Number of Delegates</div>
        <div class="value">${formData.number_of_delegates || lead?.number_of_delegates || 'N/A'}</div>
      </div>
    </div>
  `}
  ${formData.po_number ? `
  <div class="section" style="margin-top: 10px;">
    <div class="field">
      <div class="label">PO Number</div>
      <div class="value">${formData.po_number}</div>
    </div>
  </div>
  ` : ''}

  ${formData.delegates && formData.delegates.length > 0 ? `
  <h2>Delegate Details</h2>
  <div class="section">
    ${formData.delegates.map((delegate: any, index: number) => `
      <div style="margin-bottom: 25px; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        ${formData.delegates.length > 1 ? `<h3 style="margin-top: 0; color: #475569;">Delegate ${index + 1}</h3>` : ''}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          ${delegate.name ? `
          <div class="field">
            <div class="label">Name</div>
            <div class="value">${delegate.name}</div>
          </div>
          ` : ''}
          ${delegate.date_of_birth ? `
          <div class="field">
            <div class="label">Date of Birth</div>
            <div class="value">${delegate.date_of_birth}</div>
          </div>
          ` : ''}
          ${delegate.national_insurance ? `
          <div class="field">
            <div class="label">National Insurance Number</div>
            <div class="value">${delegate.national_insurance}</div>
          </div>
          ` : ''}
          ${delegate.address ? `
          <div class="field">
            <div class="label">Address</div>
            <div class="value">${delegate.address}${delegate.postcode ? '<br>' + delegate.postcode : ''}</div>
          </div>
          ` : ''}
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${formData.delegate_names && !formData.delegates ? `
  <h2>Delegate Names</h2>
  <div class="section">
    <div class="value" style="white-space: pre-wrap;">${formData.delegate_names}</div>
  </div>
  ` : ''}

  ${formData.special_requirements ? `
  <h2>Special Requirements</h2>
  <div class="section">
    <div class="value" style="white-space: pre-wrap;">${formData.special_requirements}</div>
  </div>
  ` : ''}

  <h2>Terms and Conditions</h2>
  <div class="section" style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
    <p style="font-weight: bold; margin-bottom: 12px;">Payment Terms:</p>
    <ul style="margin-left: 20px; margin-bottom: 16px; line-height: 1.6;">
      <li>Full payment is due 14 days prior to the course start date</li>
      <li>Payment can be made by bank transfer or cheque</li>
      <li>Purchase orders are accepted from approved accounts</li>
    </ul>

    <p style="font-weight: bold; margin-bottom: 12px;">Cancellation Policy:</p>
    <ul style="margin-left: 20px; margin-bottom: 16px; line-height: 1.6;">
      <li>Cancellations made more than 14 days before the course: Full refund minus £50 administration fee</li>
      <li>Cancellations made 7-14 days before the course: 50% of course fee will be charged</li>
      <li>Cancellations made less than 7 days before the course: Full course fee will be charged</li>
      <li>Delegates may be substituted at any time without charge</li>
    </ul>

    <p style="font-weight: bold; margin-bottom: 12px;">Course Changes:</p>
    <ul style="margin-left: 20px; margin-bottom: 16px; line-height: 1.6;">
      <li>We reserve the right to cancel or postpone courses due to insufficient bookings or circumstances beyond our control</li>
      <li>In the event of cancellation by us, you will be offered an alternative date or full refund</li>
      <li>We are not liable for any travel or accommodation costs incurred</li>
    </ul>

    <p style="font-weight: bold; margin-bottom: 12px;">Liability:</p>
    <ul style="margin-left: 20px; margin-bottom: 16px; line-height: 1.6;">
      <li>We accept no liability for loss or damage to delegates' personal property</li>
      <li>Delegates attend courses at their own risk</li>
      <li>We maintain appropriate insurance cover for our training activities</li>
    </ul>

    <p style="font-weight: bold; margin-bottom: 12px;">Data Protection:</p>
    <ul style="margin-left: 20px; margin-bottom: 16px; line-height: 1.6;">
      <li>Your information will be held securely and used only for course administration</li>
      <li>We will not share your details with third parties without your consent</li>
      <li>You may request access to or deletion of your data at any time</li>
    </ul>

    <p style="margin-top: 20px; padding: 15px; background: #dcfce7; border: 2px solid #86efac; border-radius: 6px; font-weight: bold; color: #166534;">
      ✓ The customer has read and agreed to these terms and conditions. They confirmed that the information provided is accurate and understand that this is a legally binding agreement.
    </p>
  </div>

  ${bookingForm.signature_data ? `
  <h2>Signature</h2>
  <div class="signature-box">
    <img src="${bookingForm.signature_data}" alt="Signature" class="signature-img" />
    ${bookingForm.signed_at ? `<p style="margin-top: 15px; color: #64748b; font-size: 14px;">Signed on ${format(new Date(bookingForm.signed_at), 'PPpp')}</p>` : ''}
  </div>
  ` : ''}

  <h2>Form Information</h2>
  <div class="section">
    <div class="field">
      <div class="label">Sent</div>
      <div class="value">${bookingForm.sent_at ? format(new Date(bookingForm.sent_at), 'PP') : 'N/A'}</div>
    </div>
    <div class="field">
      <div class="label">Signed</div>
      <div class="value">${bookingForm.signed_at ? format(new Date(bookingForm.signed_at), 'PP') : 'Not signed'}</div>
    </div>
    <div class="field">
      <div class="label">Expires</div>
      <div class="value">${bookingForm.expires_at ? format(new Date(bookingForm.expires_at), 'PP') : 'N/A'}</div>
    </div>
  </div>

  <div class="footer">
    <p>This is a digitally signed booking form. Generated on ${format(new Date(), 'PPpp')}</p>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `booking-form-${formData.contact_name || lead?.name || 'unknown'}-${format(new Date(), 'yyyy-MM-dd')}.html`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Booking form downloaded. Open in your browser and print to PDF if needed.');
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
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Form
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

          {formData.delegates && formData.delegates.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Delegate Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {formData.delegates.map((delegate: any, index: number) => (
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
                  ))}
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
          if (selectedCourseIndex !== null && bookingForm?.booking_form_courses?.[selectedCourseIndex]) {
            const courseId = bookingForm.booking_form_courses[selectedCourseIndex].id;
            setCreatedBookings(prev => ({ ...prev, [courseId]: true }));
            setMultiCourseDialogOpen(true);
          }
          await loadBookingForm();
        }}
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
