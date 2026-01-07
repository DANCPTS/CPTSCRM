'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface InvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  leadEmail?: string;
}

export function InvoiceDialog({ open, onClose, leadId, leadName, leadEmail }: InvoiceDialogProps) {
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [invoiceLater, setInvoiceLater] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'invoice' | 'stripe'>('invoice');
  const [paymentLink, setPaymentLink] = useState('');
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  const [bookingForm, setBookingForm] = useState<any>(null);
  const [clientEmail, setClientEmail] = useState('');

  useEffect(() => {
    if (open && leadId) {
      loadBookingForm();
    }
  }, [open, leadId]);

  const loadBookingForm = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_forms')
        .select(`
          *,
          booking_form_courses(*),
          leads(email, name)
        `)
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBookingForm(data);
        const isDeferred = data.invoice_number === 'DEFERRED';
        const isStripe = data.payment_type === 'stripe';
        setInvoiceLater(isDeferred);
        setInvoiceSent(data.invoice_sent || false);
        setInvoiceNumber(isDeferred || isStripe ? '' : (data.invoice_number || ''));
        setPaymentType(isStripe ? 'stripe' : 'invoice');
        setPaymentLink(data.payment_link || '');

        const email = data.form_data?.contact_email || data.leads?.email || leadEmail || '';
        setClientEmail(email);
      }
    } catch (error: any) {
      console.error('Failed to load invoice details:', error);
      toast.error('Failed to load invoice details');
    }
  };

  const handleInvoiceSubmit = async () => {
    if (!invoiceLater) {
      if (!invoiceNumber.trim()) {
        toast.error('Please enter an invoice number');
        return;
      }

      if (!invoiceSent) {
        toast.error('Please confirm the invoice has been sent');
        return;
      }
    }

    setLoading(true);

    try {
      const { data: existingForm, error: checkError } = await supabase
        .from('booking_forms')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existingForm) {
        toast.error('No booking form found for this lead. Please send a booking form first.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('booking_forms')
        .update({
          invoice_sent: invoiceLater ? false : invoiceSent,
          invoice_number: invoiceLater ? 'DEFERRED' : invoiceNumber.trim(),
          payment_type: 'invoice',
        })
        .eq('lead_id', leadId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Failed to update invoice details');
        setLoading(false);
        return;
      }

      toast.success(invoiceLater ? 'Invoice deferred successfully' : 'Invoice details saved successfully');
      onClose();
    } catch (error: any) {
      console.error('Failed to save invoice details:', error);
      toast.error('Failed to save invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleStripeSubmit = async () => {
    if (!paymentLink?.trim()) {
      toast.error('Please enter a payment link');
      return;
    }

    if (!paymentLink.includes('stripe.com') && !paymentLink.includes('buy.stripe')) {
      toast.error('Please enter a valid Stripe payment link');
      return;
    }

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
          bookingFormId: bookingForm?.id,
          clientName: bookingForm?.form_data?.contact_name || leadName,
          clientEmail,
          paymentLink: paymentLink.trim(),
          courses: bookingForm?.booking_form_courses || [],
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
        .eq('lead_id', leadId);

      if (updateError) throw updateError;

      toast.success('Payment link sent to ' + clientEmail);
      onClose();
    } catch (error: any) {
      console.error('Failed to send payment link:', error);
      toast.error(error.message || 'Failed to send payment link');
    } finally {
      setSendingPaymentLink(false);
    }
  };

  const handleClose = () => {
    setInvoiceSent(false);
    setInvoiceLater(false);
    setInvoiceNumber('');
    setPaymentType('invoice');
    setPaymentLink('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader className="pr-8">
          <DialogTitle>Payment Details - {leadName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              <div className="space-y-2">
                <Label htmlFor="invoice-number">Invoice Number</Label>
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Enter invoice number"
                  disabled={invoiceLater}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="invoice-sent"
                    checked={invoiceSent}
                    onCheckedChange={(checked) => setInvoiceSent(checked as boolean)}
                    disabled={invoiceLater}
                  />
                  <Label
                    htmlFor="invoice-sent"
                    className="text-sm font-normal cursor-pointer"
                  >
                    I have invoiced the client
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="invoice-later"
                    checked={invoiceLater}
                    onCheckedChange={(checked) => {
                      setInvoiceLater(checked as boolean);
                      if (checked) {
                        setInvoiceSent(false);
                        setInvoiceNumber('');
                      }
                    }}
                  />
                  <Label
                    htmlFor="invoice-later"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Client will be invoiced at a later date
                  </Label>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="payment-link">Stripe Payment Link</Label>
                <Input
                  id="payment-link"
                  value={paymentLink}
                  onChange={(e) => setPaymentLink(e.target.value)}
                  placeholder="https://buy.stripe.com/..."
                />
                <p className="text-xs text-slate-500">
                  Paste the Stripe payment link from your dashboard
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-sm text-slate-600">
                  <strong>Client:</strong> {bookingForm?.form_data?.contact_name || leadName}
                </div>
                <div className="text-sm text-slate-600">
                  <strong>Email:</strong> {clientEmail || 'No email found'}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={loading || sendingPaymentLink} className="w-full sm:w-auto">
            Cancel
          </Button>
          {paymentType === 'invoice' ? (
            <Button onClick={handleInvoiceSubmit} disabled={loading} className="w-full sm:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invoiceLater ? 'Defer Invoice' : 'Save Invoice Details'}
            </Button>
          ) : (
            <Button onClick={handleStripeSubmit} disabled={sendingPaymentLink} className="w-full sm:w-auto">
              {sendingPaymentLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Payment Link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
