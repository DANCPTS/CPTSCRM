'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Link } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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
import { getBookings, getDelegatesForBookings } from '@/lib/db-helpers';
import { format, parseISO } from 'date-fns';
import { BookingDialog } from '@/components/booking-dialog';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [delegateMap, setDelegateMap] = useState<Map<string, Map<string, string[]>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const data = await getBookings();
      setBookings(data);

      const leadIds = Array.from(new Set(data.filter((b: any) => b.lead_id).map((b: any) => b.lead_id)));
      const delegates = await getDelegatesForBookings(leadIds);
      setDelegateMap(delegates);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDelegateNames = (booking: any): string | null => {
    if (!booking.lead_id) return null;
    const courseTitle = booking.course_runs?.courses?.title;
    if (!courseTitle) return null;

    const leadDelegates = delegateMap.get(booking.lead_id);
    if (!leadDelegates) return null;

    const normalizedTitle = courseTitle.toLowerCase().trim();
    const delegates = leadDelegates.get(normalizedTitle);
    return delegates && delegates.length > 0 ? delegates.join(', ') : null;
  };

  const statusColors: Record<string, string> = {
    reserved: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const handleCancelBooking = (booking: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookingToCancel(booking);
    setCancelDialogOpen(true);
  };

  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingToCancel.id);

      if (error) throw error;

      toast.success('Booking cancelled successfully');
      setCancelDialogOpen(false);
      setBookingToCancel(null);
      loadBookings();
    } catch (error: any) {
      toast.error('Failed to cancel booking');
      console.error(error);
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Bookings</h1>
            <p className="text-slate-600 mt-1">Course bookings and registrations</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map(booking => {
              const delegateNames = getDelegateNames(booking);
              const bookerName = booking.contacts
                ? `${booking.contacts.first_name || ''} ${booking.contacts.last_name || ''}`.trim()
                : null;
              const candidateName = booking.candidates
                ? `${booking.candidates.first_name} ${booking.candidates.last_name}`
                : null;

              return (
              <Card key={booking.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">
                        {candidateName || delegateNames || bookerName || 'Unknown'}
                        {booking.companies && ` - ${booking.companies.name}`}
                      </h3>
                      {delegateNames && bookerName && !candidateName && (
                        <p className="text-xs text-slate-500 mb-1">Booked by: {bookerName}</p>
                      )}
                      <p className="text-sm text-slate-600">
                        {booking.course_runs?.courses?.title}
                        {' • '}
                        {booking.course_runs && format(parseISO(booking.course_runs.start_date), 'MMM d, yyyy')}
                        {booking.start_time && (
                          <span className="text-slate-500">
                            {' @ '}
                            {(() => {
                              const [h, m] = booking.start_time.split(':').map(Number);
                              const period = h >= 12 ? 'PM' : 'AM';
                              const displayH = h % 12 || 12;
                              return m === 0 ? `${displayH} ${period}` : `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
                            })()}
                          </span>
                        )}
                        {' • '}
                        £{(booking.net_amount || booking.amount || 0).toFixed(2)}
                        {!booking.vat_exempt && (
                          <span className="text-slate-400"> + VAT</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {booking.invoice_no && (
                          <span className="text-xs text-slate-500">Invoice: {booking.invoice_no}</span>
                        )}
                        {booking.payment_link && (
                          <a
                            href={booking.payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link className="h-3 w-3" />
                            Payment Link
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {booking.vat_exempt && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          VAT Exempt
                        </Badge>
                      )}
                      <Badge className={statusColors[booking.status]}>
                        {booking.status}
                      </Badge>
                      {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleCancelBooking(booking, e)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      <BookingDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          loadBookings();
        }}
      />

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking for{' '}
              <strong>
                {bookingToCancel?.candidates
                  ? `${bookingToCancel.candidates.first_name} ${bookingToCancel.candidates.last_name}`
                  : `${bookingToCancel?.contacts?.first_name || ''} ${bookingToCancel?.contacts?.last_name || ''}`
                }
              </strong>
              ? This will free up a seat on the course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelBooking}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
