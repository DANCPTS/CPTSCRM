'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

export default function BookingFormPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [customerType, setCustomerType] = useState<'business' | 'individual'>('business');
  const [formData, setFormData] = useState({
    company_name: '',
    registration_no: '',
    vat_no: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    city: '',
    postcode: '',
    course_name: '',
    course_dates: '',
    course_venue: '',
    number_of_delegates: '',
    delegate_names: '',
    po_number: '',
    special_requirements: '',
    agreed_to_terms: false,
  });

  interface DelegateDetails {
    name: string;
    national_insurance: string;
    date_of_birth: string;
    address: string;
    postcode: string;
  }

  const [delegates, setDelegates] = useState<DelegateDetails[]>([]);

  const [bookingForm, setBookingForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBookingForm();
  }, [token]);

  const loadBookingForm = async () => {
    try {
      console.log('Loading booking form with token:', token);

      const { data, error } = await supabase
        .from('booking_forms')
        .select(`
          *,
          leads(*)
        `)
        .eq('token', token)
        .maybeSingle();

      console.log('Query result:', { data, error });

      if (error) throw error;

      if (!data) {
        console.error('No data returned from query');
        toast.error('Booking form not found or has expired');
        return;
      }

      console.log('Booking form data:', data);
      console.log('Leads data:', data.leads);

      if (data.status === 'signed') {
        toast.info('This form has already been submitted');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast.error('This booking form has expired');
        return;
      }

      setBookingForm(data);

      if (data.leads) {
        console.log('Lead data:', data.leads);
        console.log('Quoted course:', data.leads.quoted_course);
        console.log('Quoted dates:', data.leads.quoted_dates);

        const newFormData = {
          company_name: data.leads.company_name || '',
          registration_no: '',
          vat_no: '',
          contact_name: data.leads.name || '',
          contact_email: data.leads.email || '',
          contact_phone: data.leads.phone || '',
          address: '',
          city: '',
          postcode: '',
          course_name: data.leads.quoted_course || '',
          course_dates: data.leads.quoted_dates || '',
          course_venue: data.leads.quoted_venue || '',
          number_of_delegates: data.leads.number_of_delegates?.toString() || '',
          delegate_names: '',
          po_number: '',
          special_requirements: data.leads.quote_notes || '',
          agreed_to_terms: false,
        };

        console.log('Setting form data to:', newFormData);
        setFormData(newFormData);

        if (!data.leads.company_name) {
          setCustomerType('individual');
        }

        const numDelegates = parseInt(data.leads.number_of_delegates?.toString() || '1');
        setDelegates(Array(numDelegates).fill(null).map(() => ({
          name: '',
          national_insurance: '',
          date_of_birth: '',
          address: '',
          postcode: '',
        })));
      }
    } catch (error) {
      console.error('Failed to load booking form:', error);
      toast.error('Failed to load booking form');
    } finally {
      setLoading(false);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agreed_to_terms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    if (!hasSignature) {
      toast.error('Please provide your signature');
      return;
    }

    for (let i = 0; i < delegates.length; i++) {
      const delegate = delegates[i];
      if (!delegate.name || !delegate.national_insurance || !delegate.date_of_birth || !delegate.address || !delegate.postcode) {
        toast.error(`Please complete all fields for Delegate ${i + 1}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');

      const signatureData = canvas.toDataURL('image/png');

      console.log('Submitting booking form with token:', token);
      console.log('Form data:', formData);

      const { data: updateData, error: updateError } = await supabase
        .from('booking_forms')
        .update({
          status: 'signed',
          form_data: { ...formData, customer_type: customerType, delegates },
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('token', token)
        .select();

      console.log('Update result:', { updateData, updateError });

      if (updateError) {
        console.error('Update error details:', updateError);
        throw new Error(`Failed to update booking form: ${updateError.message}`);
      }

      if (!bookingForm.lead_id) {
        console.warn('No lead_id found on booking form');
      } else {
        const { data: leadData, error: leadFetchError } = await supabase
          .from('leads')
          .select('id, company_id')
          .eq('id', bookingForm.lead_id)
          .maybeSingle();

        if (leadFetchError) {
          console.error('Lead fetch error:', leadFetchError);
        }

        const { error: leadError } = await supabase
          .from('leads')
          .update({ status: 'won' })
          .eq('id', bookingForm.lead_id);

        if (leadError) {
          console.error('Lead update error:', leadError);
          throw new Error(`Failed to update lead: ${leadError.message}`);
        }

        if (leadData?.company_id && customerType === 'business' && formData.address) {
          const companyUpdateData: any = {
            address: formData.address,
            postcode: formData.postcode,
            updated_at: new Date().toISOString(),
          };

          if (formData.city) {
            companyUpdateData.city = formData.city;
          }

          if (formData.registration_no) {
            companyUpdateData.registration_no = formData.registration_no;
          }

          if (formData.vat_no) {
            companyUpdateData.vat_no = formData.vat_no;
          }

          const { error: companyError } = await supabase
            .from('companies')
            .update(companyUpdateData)
            .eq('id', leadData.company_id);

          if (companyError) {
            console.error('Company update error:', companyError);
          }
        }
      }

      toast.success('Booking form submitted successfully!');

      setTimeout(() => {
        window.location.href = '/booking-form/success';
      }, 1500);
    } catch (error: any) {
      console.error('Failed to submit form:', error);
      toast.error(error.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading booking form...</p>
        </div>
      </div>
    );
  }

  if (!bookingForm || bookingForm.status === 'signed' || new Date(bookingForm.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Form Unavailable</CardTitle>
            <CardDescription>
              This booking form is no longer available. Please contact us if you need assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Training Course Booking Form</CardTitle>
            <CardDescription>
              Please complete this form to confirm your booking. All fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3 border-b pb-6">
                <Label className="text-base font-semibold">Customer Type *</Label>
                <RadioGroup value={customerType} onValueChange={(value) => setCustomerType(value as 'business' | 'individual')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="business" id="business" />
                    <Label htmlFor="business" className="font-normal cursor-pointer">Business</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="individual" id="individual" />
                    <Label htmlFor="individual" className="font-normal cursor-pointer">Individual</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customerType === 'business' && (
                    <>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="company_name">Company Name *</Label>
                        <Input
                          id="company_name"
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          required={customerType === 'business'}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="registration_no">Company Registration Number</Label>
                        <Input
                          id="registration_no"
                          value={formData.registration_no}
                          onChange={(e) => setFormData({ ...formData, registration_no: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vat_no">VAT Number</Label>
                        <Input
                          id="vat_no"
                          value={formData.vat_no}
                          onChange={(e) => setFormData({ ...formData, vat_no: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="contact_name">{customerType === 'business' ? 'Contact Name' : 'Full Name'} *</Label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Contact Number *</Label>
                    <Input
                      id="contact_phone"
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="contact_email">Email Address *</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode *</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Course Details</h3>
                <div className="bg-gray-50 p-4 rounded-lg border mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-sm text-gray-600">Course Name</Label>
                      <p className="font-medium">{formData.course_name}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm text-gray-600">Course Dates</Label>
                      <p className="font-medium">{formData.course_dates}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm text-gray-600">Course Venue</Label>
                      <p className="font-medium">{formData.course_venue}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm text-gray-600">Number of Delegates</Label>
                      <p className="font-medium">{formData.number_of_delegates}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="po_number">PO Number (if applicable)</Label>
                    <Input
                      id="po_number"
                      value={formData.po_number}
                      onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    />
                  </div>

                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Delegate Information</h3>
                <p className="text-sm text-slate-600 mb-4">Please provide details for each delegate attending the course</p>

                <div className="space-y-6">
                  {delegates.map((delegate, index) => (
                    <Card key={index} className="bg-slate-50">
                      <CardHeader>
                        <CardTitle className="text-base">Delegate {index + 1}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`delegate_name_${index}`}>Full Name *</Label>
                            <Input
                              id={`delegate_name_${index}`}
                              value={delegate.name}
                              onChange={(e) => {
                                const newDelegates = [...delegates];
                                newDelegates[index].name = e.target.value;
                                setDelegates(newDelegates);
                              }}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`delegate_ni_${index}`}>National Insurance Number *</Label>
                            <Input
                              id={`delegate_ni_${index}`}
                              value={delegate.national_insurance}
                              onChange={(e) => {
                                const newDelegates = [...delegates];
                                newDelegates[index].national_insurance = e.target.value.toUpperCase();
                                setDelegates(newDelegates);
                              }}
                              placeholder="AB123456C"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`delegate_dob_${index}`}>Date of Birth *</Label>
                            <Input
                              id={`delegate_dob_${index}`}
                              type="date"
                              value={delegate.date_of_birth}
                              onChange={(e) => {
                                const newDelegates = [...delegates];
                                newDelegates[index].date_of_birth = e.target.value;
                                setDelegates(newDelegates);
                              }}
                              required
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`delegate_address_${index}`}>Home Address *</Label>
                            <Textarea
                              id={`delegate_address_${index}`}
                              value={delegate.address}
                              onChange={(e) => {
                                const newDelegates = [...delegates];
                                newDelegates[index].address = e.target.value;
                                setDelegates(newDelegates);
                              }}
                              rows={2}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`delegate_postcode_${index}`}>Postcode *</Label>
                            <Input
                              id={`delegate_postcode_${index}`}
                              value={delegate.postcode}
                              onChange={(e) => {
                                const newDelegates = [...delegates];
                                newDelegates[index].postcode = e.target.value.toUpperCase();
                                setDelegates(newDelegates);
                              }}
                              required
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="special_requirements">Special Requirements / Dietary Requirements</Label>
                    <Textarea
                      id="special_requirements"
                      value={formData.special_requirements}
                      onChange={(e) => setFormData({ ...formData, special_requirements: e.target.value })}
                      rows={3}
                      placeholder="Please list any special requirements or dietary needs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold">Signature *</h3>
                <p className="text-sm text-gray-600">Please sign in the box below using your mouse or touchpad</p>
                <div className="border-2 border-gray-300 rounded-lg bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                  Clear Signature
                </Button>
              </div>

              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold">Terms and Conditions</h3>
                <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto text-sm space-y-3">
                  <p className="font-semibold">Payment Terms:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Full payment is due 14 days prior to the course start date</li>
                    <li>Payment can be made by bank transfer or cheque</li>
                    <li>Purchase orders are accepted from approved accounts</li>
                  </ul>

                  <p className="font-semibold mt-4">Cancellation Policy:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Cancellations made more than 14 days before the course: Full refund minus £50 administration fee</li>
                    <li>Cancellations made 7-14 days before the course: 50% of course fee will be charged</li>
                    <li>Cancellations made less than 7 days before the course: Full course fee will be charged</li>
                    <li>Delegates may be substituted at any time without charge</li>
                  </ul>

                  <p className="font-semibold mt-4">Course Changes:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>We reserve the right to cancel or postpone courses due to insufficient bookings or circumstances beyond our control</li>
                    <li>In the event of cancellation by us, you will be offered an alternative date or full refund</li>
                    <li>We are not liable for any travel or accommodation costs incurred</li>
                  </ul>

                  <p className="font-semibold mt-4">Liability:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>We accept no liability for loss or damage to delegates' personal property</li>
                    <li>Delegates attend courses at their own risk</li>
                    <li>We maintain appropriate insurance cover for our training activities</li>
                  </ul>

                  <p className="font-semibold mt-4">Data Protection:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your information will be held securely and used only for course administration</li>
                    <li>We will not share your details with third parties without your consent</li>
                    <li>You may request access to or deletion of your data at any time</li>
                  </ul>
                </div>

                <div className="flex items-start space-x-2 pt-4">
                  <Checkbox
                    id="terms"
                    checked={formData.agreed_to_terms}
                    onCheckedChange={(checked) => setFormData({ ...formData, agreed_to_terms: checked as boolean })}
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                    I have read and agree to the terms and conditions above. I confirm that the information provided is accurate and understand that this is a legally binding agreement. *
                  </Label>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <Button type="submit" disabled={submitting} size="lg" className="min-w-[200px]">
                  {submitting ? 'Submitting...' : 'Submit Booking Form'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
