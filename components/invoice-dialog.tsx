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
}

export function InvoiceDialog({ open, onClose, leadId, leadName }: InvoiceDialogProps) {
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [invoiceLater, setInvoiceLater] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    if (open && leadId) {
      loadBookings();
    }
  }, [open, leadId]);

  const loadBookings = async () => {
    try {
      // Load from booking_forms table
      const { data, error } = await supabase
        .from('booking_forms')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const isDeferred = data.invoice_number === 'DEFERRED';
        setInvoiceLater(isDeferred);
        setInvoiceSent(data.invoice_sent || false);
        setInvoiceNumber(isDeferred ? '' : (data.invoice_number || ''));
      }
    } catch (error: any) {
      console.error('Failed to load invoice details:', error);
      toast.error('Failed to load invoice details');
    }
  };

  const handleSubmit = async () => {
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
      // Update booking_forms table
      const { error } = await supabase
        .from('booking_forms')
        .update({
          invoice_sent: invoiceLater ? false : invoiceSent,
          invoice_number: invoiceLater ? 'DEFERRED' : invoiceNumber.trim(),
        })
        .eq('lead_id', leadId);

      if (error) throw error;

      toast.success(invoiceLater ? 'Invoice deferred successfully' : 'Invoice details saved successfully');

      onClose();
    } catch (error: any) {
      console.error('Failed to save invoice details:', error);
      toast.error('Failed to save invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setInvoiceSent(false);
    setInvoiceLater(false);
    setInvoiceNumber('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader className="pr-8">
          <DialogTitle>Invoice Details - {leadName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={loading} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {invoiceLater ? 'Defer Invoice' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
