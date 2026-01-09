'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface EditBookingDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  booking: any;
}

export function EditBookingDialog({ open, onClose, onSuccess, booking }: EditBookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: 'reserved',
    amount: '',
    vat_exempt: false,
    invoice_no: '',
    certificate_no: '',
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

  useEffect(() => {
    if (booking && open) {
      setFormData({
        status: booking.status || 'reserved',
        amount: (booking.net_amount || booking.amount || 0).toString(),
        vat_exempt: booking.vat_exempt || false,
        invoice_no: booking.invoice_no || '',
        certificate_no: booking.certificate_no || '',
        payment_link: booking.payment_link || '',
        start_time: booking.start_time || '08:00',
      });
    }
  }, [booking, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const netAmount = parseFloat(formData.amount) || 0;
      const vatAmount = formData.vat_exempt ? 0 : netAmount * 0.20;

      const { error } = await supabase
        .from('bookings')
        .update({
          status: formData.status,
          amount: netAmount,
          net_amount: netAmount,
          vat_amount: vatAmount,
          vat_exempt: formData.vat_exempt,
          invoice_no: formData.invoice_no || null,
          certificate_no: formData.certificate_no || null,
          payment_link: formData.payment_link || null,
          start_time: formData.start_time,
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast.success('Booking updated successfully');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update booking');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  const candidateName = booking.candidates
    ? `${booking.candidates.first_name} ${booking.candidates.last_name}`
    : null;
  const contactName = booking.contacts
    ? `${booking.contacts.first_name || ''} ${booking.contacts.last_name || ''}`.trim()
    : null;
  const displayName = candidateName || contactName || 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>Update booking details</DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Client:</span> {displayName}</p>
            {booking.companies && (
              <p><span className="font-medium">Company:</span> {booking.companies.name}</p>
            )}
            <p><span className="font-medium">Course:</span> {booking.course_runs?.courses?.title}</p>
            <p>
              <span className="font-medium">Date:</span>{' '}
              {booking.course_runs?.start_date && format(parseISO(booking.course_runs.start_date), 'EEEE, MMMM d, yyyy')}
            </p>
            <p><span className="font-medium">Location:</span> {booking.course_runs?.location}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
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
              <Label htmlFor="start_time">Start Time</Label>
              <Select
                value={formData.start_time}
                onValueChange={(value) => setFormData({ ...formData, start_time: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {startTimeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
            <div>
              <Label htmlFor="vat_exempt" className="font-medium">VAT Exempt (Dubai Account)</Label>
              <p className="text-xs text-slate-500 mt-0.5">Enable for bookings through the Dubai account</p>
            </div>
            <Switch
              id="vat_exempt"
              checked={formData.vat_exempt}
              onCheckedChange={(checked) => setFormData({ ...formData, vat_exempt: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Net Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>

          {formData.amount && (
            <div className="p-3 bg-slate-50 rounded-lg border">
              <div className="text-sm text-slate-600 mb-2">Price Breakdown</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Net Amount:</span>
                  <span className="font-medium">£{parseFloat(formData.amount).toFixed(2)}</span>
                </div>
                {!formData.vat_exempt && (
                  <div className="flex justify-between text-sm">
                    <span>VAT (20%):</span>
                    <span className="font-medium">£{(parseFloat(formData.amount) * 0.20).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                  <span>Total:</span>
                  <span>
                    £{formData.vat_exempt
                      ? parseFloat(formData.amount).toFixed(2)
                      : (parseFloat(formData.amount) * 1.20).toFixed(2)
                    }
                  </span>
                </div>
                {formData.vat_exempt && (
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
                value={formData.invoice_no}
                onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificate_no">Certificate No</Label>
              <Input
                id="certificate_no"
                value={formData.certificate_no}
                onChange={(e) => setFormData({ ...formData, certificate_no: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_link">Stripe Payment Link</Label>
            <Input
              id="payment_link"
              type="url"
              placeholder="https://buy.stripe.com/..."
              value={formData.payment_link}
              onChange={(e) => setFormData({ ...formData, payment_link: e.target.value })}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
