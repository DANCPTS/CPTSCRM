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
import { Plus, Trash2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

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
    email: string;
    phone: string;
    national_insurance: string;
    date_of_birth: string;
    address: string;
    postcode: string;
    selectedCourses: string[];
  }

  interface CourseDetails {
    id: string;
    course_name: string;
    course_dates: string;
    course_venue: string;
    number_of_delegates: number;
    price: number;
    currency: string;
    display_order: number;
  }

  const [delegates, setDelegates] = useState<DelegateDetails[]>([]);
  const [courses, setCourses] = useState<CourseDetails[]>([]);
  const [sameAsContact, setSameAsContact] = useState<boolean[]>([]);
  const [delegateCardRefs, setDelegateCardRefs] = useState<(HTMLDivElement | null)[]>([]);

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

      if (data.status === 'signed') {
        toast.info('This form has already been submitted');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast.error('This booking form has expired');
        return;
      }

      setBookingForm(data);

      const { data: coursesData, error: coursesError } = await supabase
        .from('booking_form_courses')
        .select('*')
        .eq('booking_form_id', data.id)
        .order('display_order');

      if (coursesError) {
        console.error('Error loading courses:', coursesError);
      } else if (coursesData && coursesData.length > 0) {
        setCourses(coursesData);

        const totalDelegatesNeeded = coursesData.reduce((sum, course) =>
          Math.max(sum, course.number_of_delegates), 0
        );

        const autoSelectCourses = coursesData.length === 1 ? [coursesData[0].id] : [];

        setDelegates(Array(totalDelegatesNeeded).fill(null).map(() => ({
          name: '',
          email: '',
          phone: '',
          national_insurance: '',
          date_of_birth: '',
          address: '',
          postcode: '',
          selectedCourses: autoSelectCourses,
        })));

        setSameAsContact(Array(totalDelegatesNeeded).fill(false));
      }

      if (data.leads) {
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
          course_name: coursesData?.[0]?.course_name || data.leads.quoted_course || '',
          course_dates: coursesData?.[0]?.course_dates || data.leads.quoted_dates || '',
          course_venue: coursesData?.[0]?.course_venue || data.leads.quoted_venue || '',
          number_of_delegates: data.total_delegates?.toString() || data.leads.number_of_delegates?.toString() || '',
          delegate_names: '',
          po_number: '',
          special_requirements: data.leads.quote_notes || '',
          agreed_to_terms: false,
        };

        setFormData(newFormData);

        if (!data.leads.company_name) {
          setCustomerType('individual');
        }
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

  const startTouchDrawing = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const touch = e.touches[0];
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const touchDraw = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const touch = e.touches[0];
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    setHasSignature(true);
  };

  const stopTouchDrawing = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
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

  const addDelegate = () => {
    const newDelegate: DelegateDetails = {
      name: '',
      email: '',
      phone: '',
      national_insurance: '',
      date_of_birth: '',
      address: '',
      postcode: '',
      selectedCourses: [],
    };
    setDelegates([...delegates, newDelegate]);
    setSameAsContact([...sameAsContact, false]);

    setTimeout(() => {
      const lastIndex = delegates.length;
      if (delegateCardRefs[lastIndex]) {
        delegateCardRefs[lastIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const removeDelegate = (index: number) => {
    if (delegates.length <= getMinimumDelegatesRequired()) {
      toast.error(`Cannot remove delegate. At least ${getMinimumDelegatesRequired()} delegate(s) required.`);
      return;
    }

    const newDelegates = delegates.filter((_, i) => i !== index);
    setDelegates(newDelegates);

    const newSameAsContact = sameAsContact.filter((_, i) => i !== index);
    setSameAsContact(newSameAsContact);

    toast.success('Delegate removed');
  };

  const getMinimumDelegatesRequired = () => {
    if (courses.length === 0) return 1;
    return Math.max(...courses.map(c => c.number_of_delegates));
  };

  const getCourseValidationStatus = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return { status: 'unknown', assigned: 0, required: 0 };

    const assigned = delegates.filter(d => d.selectedCourses.includes(courseId)).length;
    const required = course.number_of_delegates;

    if (assigned === required) return { status: 'valid', assigned, required };
    if (assigned < required) return { status: 'insufficient', assigned, required };
    return { status: 'excess', assigned, required };
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
        toast.error(`Please complete all required fields for Delegate ${i + 1}`);
        return;
      }

      if (courses.length > 0 && delegate.selectedCourses.length === 0) {
        toast.error(`Please select at least one course for Delegate ${i + 1}`);
        return;
      }
    }

    if (courses.length > 0) {
      for (const course of courses) {
        const assignedDelegates = delegates.filter(d => d.selectedCourses.includes(course.id));
        if (assignedDelegates.length !== course.number_of_delegates) {
          toast.error(`Course "${course.course_name}" requires exactly ${course.number_of_delegates} delegate(s), but ${assignedDelegates.length} assigned. Please adjust the course assignments.`);
          return;
        }
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
          form_data: { ...formData, customer_type: customerType },
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

      const delegatesToInsert = delegates.map(delegate => ({
        booking_form_id: bookingForm.id,
        name: delegate.name,
        email: delegate.email || null,
        phone: delegate.phone || null,
        national_insurance: delegate.national_insurance,
        date_of_birth: delegate.date_of_birth,
        address: delegate.address,
        postcode: delegate.postcode,
      }));

      const { data: insertedDelegates, error: delegatesError } = await supabase
        .from('booking_form_delegates')
        .insert(delegatesToInsert)
        .select();

      if (delegatesError) {
        console.error('Delegates insert error:', delegatesError);
        throw new Error(`Failed to save delegates: ${delegatesError.message}`);
      }

      if (courses.length > 0 && insertedDelegates) {
        const delegateCourseAssignments = [];
        for (let i = 0; i < delegates.length; i++) {
          const delegate = delegates[i];
          const insertedDelegate = insertedDelegates[i];
          for (const courseId of delegate.selectedCourses) {
            delegateCourseAssignments.push({
              booking_form_id: bookingForm.id,
              delegate_id: insertedDelegate.id,
              course_id: courseId,
            });
          }
        }

        if (delegateCourseAssignments.length > 0) {
          const { error: assignmentsError } = await supabase
            .from('booking_form_delegate_courses')
            .insert(delegateCourseAssignments);

          if (assignmentsError) {
            console.error('Delegate course assignments error:', assignmentsError);
            throw new Error(`Failed to save course assignments: ${assignmentsError.message}`);
          }
        }
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center">
          <img
            src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png"
            alt="CPTS Training"
            className="h-20 mx-auto mb-6 animate-pulse"
          />
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#F28D00] mx-auto"></div>
          <p className="mt-4 text-[#0f3d5e] font-semibold">Loading booking form...</p>
        </div>
      </div>
    );
  }

  if (!bookingForm || bookingForm.status === 'signed' || new Date(bookingForm.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="bg-gradient-to-r from-[#0f3d5e] to-[#1a5578] text-white text-center pb-8">
            <img
              src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png"
              alt="CPTS Training"
              className="h-16 mx-auto mb-4"
            />
            <CardTitle className="text-2xl">Form Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600">
              This booking form is no longer available. Please contact us if you need assistance.
            </p>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg border-l-4 border-[#F28D00]">
              <p className="text-sm text-slate-600">
                <strong className="text-[#0f3d5e]">Contact us:</strong><br />
                daniel@cpts.uk
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#0f3d5e] rounded-t-2xl p-8 text-white text-center shadow-lg">
          <img
            src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png"
            alt="CPTS Training"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold mb-2">Training Course Booking Form</h1>
          <p className="text-slate-200 text-sm">
            Please complete this form to confirm your booking. All fields marked with * are required.
          </p>
        </div>

        <Card className="rounded-t-none shadow-xl border-t-0">
          <CardContent className="pt-8">
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
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#F28D00]">
                  <div className="w-1 h-6 bg-[#F28D00] rounded-full"></div>
                  <h3 className="text-xl font-bold text-[#0f3d5e]">Contact Details</h3>
                </div>
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
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#F28D00]">
                  <div className="w-1 h-6 bg-[#F28D00] rounded-full"></div>
                  <h3 className="text-xl font-bold text-[#0f3d5e]">{courses.length > 1 ? 'Courses Included' : 'Course Details'}</h3>
                </div>
                <div className="space-y-3 mb-4">
                  {courses.length > 0 ? (
                    <>
                      {courses.map((course, index) => (
                        <div key={course.id} className="bg-gradient-to-r from-slate-50 to-white p-5 rounded-lg border-l-4 border-[#F28D00] shadow-sm hover:shadow-md transition-shadow">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-sm text-gray-600">Course {courses.length > 1 ? `${index + 1}` : ''} Name</Label>
                              <p className="font-medium">{course.course_name}</p>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-sm text-gray-600">Course Dates</Label>
                              <p className="font-medium">{course.course_dates || 'TBC'}</p>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-sm text-gray-600">Course Venue</Label>
                              <p className="font-medium">{course.course_venue || 'TBC'}</p>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-sm text-gray-600">Delegates Needed</Label>
                              <p className="font-medium">{course.number_of_delegates}</p>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-sm text-gray-600">Price</Label>
                              <p className="font-medium text-[#F28D00]">{course.currency} {course.price.toFixed(2)} + VAT</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {courses.length > 1 && (
                        <div className="bg-gradient-to-r from-[#0f3d5e] to-[#1a5578] text-white p-5 rounded-lg shadow-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-slate-200 font-medium">Total Delegates:</Label>
                              <p className="font-bold text-2xl mt-1">{courses.reduce((sum, c) => sum + c.number_of_delegates, 0)}</p>
                            </div>
                            <div>
                              <Label className="text-sm text-slate-200 font-medium">Total Price:</Label>
                              <p className="font-bold text-2xl mt-1 text-[#F9B000]">{courses[0]?.currency} {courses.reduce((sum, c) => sum + c.price, 0).toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <p className="text-center text-gray-500">Course details will be confirmed shortly</p>
                    </div>
                  )}
                </div>
                {customerType === 'business' && (
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
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b-2 border-[#F28D00]">
                  <div className="w-1 h-6 bg-[#F28D00] rounded-full"></div>
                  <h3 className="text-xl font-bold text-[#0f3d5e]">Delegate Information</h3>
                </div>
                <p className="text-sm text-slate-600 mb-2">Please provide details for each delegate attending the course</p>
                {courses.length > 0 && (
                  <p className="text-sm text-slate-600 mb-4">
                    Select which courses each delegate will attend. You can add more delegates if needed.
                  </p>
                )}

                {courses.length > 0 && (
                  <Card className="mb-6 border-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-slate-700">Course Assignment Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {courses.map((course) => {
                          const validation = getCourseValidationStatus(course.id);
                          return (
                            <div
                              key={course.id}
                              className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                                validation.status === 'valid'
                                  ? 'bg-green-50 border-green-200'
                                  : validation.status === 'insufficient'
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-red-50 border-red-200'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {validation.status === 'valid' && (
                                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                )}
                                {validation.status === 'insufficient' && (
                                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                )}
                                {validation.status === 'excess' && (
                                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-slate-900 truncate">{course.course_name}</p>
                                  <p className="text-xs text-slate-600">{course.course_dates} • {course.course_venue}</p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <p className={`text-sm font-bold ${
                                  validation.status === 'valid'
                                    ? 'text-green-600'
                                    : validation.status === 'insufficient'
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                                }`}>
                                  {validation.assigned} / {validation.required}
                                </p>
                                <p className="text-xs text-slate-600">assigned</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Total unique delegates:</span>
                          <span className="font-bold text-slate-900">{delegates.length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-6">
                  {delegates.map((delegate, index) => (
                    <Card
                      key={index}
                      ref={(el) => {
                        const newRefs = [...delegateCardRefs];
                        newRefs[index] = el;
                        if (JSON.stringify(newRefs) !== JSON.stringify(delegateCardRefs)) {
                          setDelegateCardRefs(newRefs);
                        }
                      }}
                      className="border-l-4 border-[#0f3d5e] bg-gradient-to-r from-slate-50 to-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="bg-gradient-to-r from-[#0f3d5e] to-[#1a5578] text-white">
                        <CardTitle className="text-lg font-bold flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#F28D00] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </span>
                            Delegate {index + 1}
                          </div>
                          {delegates.length > getMinimumDelegatesRequired() && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDelegate(index)}
                              className="text-white hover:bg-red-600 hover:text-white"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="mb-4 pb-4 border-b border-slate-200">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`same_as_contact_${index}`}
                              checked={sameAsContact[index] || false}
                              onCheckedChange={(checked) => {
                                const newSameAsContact = [...sameAsContact];
                                newSameAsContact[index] = checked as boolean;
                                setSameAsContact(newSameAsContact);

                                const newDelegates = [...delegates];
                                if (checked) {
                                  newDelegates[index].name = formData.contact_name;
                                  newDelegates[index].email = formData.contact_email;
                                  newDelegates[index].phone = formData.contact_phone;
                                } else {
                                  newDelegates[index].name = '';
                                  newDelegates[index].email = '';
                                  newDelegates[index].phone = '';
                                }
                                setDelegates(newDelegates);
                              }}
                            />
                            <Label htmlFor={`same_as_contact_${index}`} className="text-sm font-medium cursor-pointer text-[#0f3d5e]">
                              Same details as booking contact
                            </Label>
                          </div>
                        </div>

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
                            <Label htmlFor={`delegate_email_${index}`}>Email Address (Optional)</Label>
                            <Input
                              id={`delegate_email_${index}`}
                              type="email"
                              value={delegate.email}
                              onChange={(e) => {
                                const newDelegates = [...delegates];
                                newDelegates[index].email = e.target.value;
                                setDelegates(newDelegates);
                              }}
                              placeholder="delegate@example.com"
                            />
                            <p className="text-xs text-slate-500">If different from booking contact</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`delegate_phone_${index}`}>Phone Number (Optional)</Label>
                            <Input
                              id={`delegate_phone_${index}`}
                              type="tel"
                              value={delegate.phone}
                              onChange={(e) => {
                                const newDelegates = [...delegates];
                                newDelegates[index].phone = e.target.value;
                                setDelegates(newDelegates);
                              }}
                              placeholder="07123 456789"
                            />
                            <p className="text-xs text-slate-500">If different from booking contact</p>
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

                          {courses.length > 0 && (
                            <div className="space-y-2 md:col-span-2 border-t pt-4 mt-4">
                              <Label className="text-base font-medium">Select Courses for this Delegate *</Label>
                              <p className="text-xs text-slate-500 mb-2">
                                {courses.length === 1
                                  ? 'Confirm this delegate will attend the course below'
                                  : 'Choose which course(s) this delegate will attend'
                                }
                              </p>
                              <div className="space-y-2">
                                {courses.map((course) => {
                                  const validation = getCourseValidationStatus(course.id);
                                  return (
                                    <div key={course.id} className="flex items-start space-x-3 bg-white p-3 rounded border">
                                      <Checkbox
                                        id={`delegate_${index}_course_${course.id}`}
                                        checked={delegate.selectedCourses.includes(course.id)}
                                        onCheckedChange={(checked) => {
                                          const newDelegates = [...delegates];
                                          if (checked) {
                                            newDelegates[index].selectedCourses = [...newDelegates[index].selectedCourses, course.id];
                                          } else {
                                            newDelegates[index].selectedCourses = newDelegates[index].selectedCourses.filter(id => id !== course.id);
                                          }
                                          setDelegates(newDelegates);
                                        }}
                                      />
                                      <div className="flex-1">
                                        <label
                                          htmlFor={`delegate_${index}_course_${course.id}`}
                                          className="text-sm font-medium cursor-pointer"
                                        >
                                          {course.course_name}
                                        </label>
                                        <p className="text-xs text-slate-500">
                                          {course.course_dates} • {course.course_venue}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                          {validation.status === 'valid' && (
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Complete ({validation.assigned}/{validation.required})
                                            </span>
                                          )}
                                          {validation.status === 'insufficient' && (
                                            <span className="text-xs text-amber-600 flex items-center gap-1">
                                              <AlertCircle className="h-3 w-3" />
                                              Need {validation.required - validation.assigned} more
                                            </span>
                                          )}
                                          {validation.status === 'excess' && (
                                            <span className="text-xs text-red-600 flex items-center gap-1">
                                              <XCircle className="h-3 w-3" />
                                              Too many ({validation.assigned}/{validation.required})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                                This delegate is assigned to: <span className="font-semibold">{delegate.selectedCourses.length} course(s)</span>
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-6 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDelegate}
                    className="border-2 border-[#0f3d5e] text-[#0f3d5e] hover:bg-[#0f3d5e] hover:text-white font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Delegate
                  </Button>
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

              <div className="space-y-4 border-t-2 border-[#F28D00] pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-6 bg-[#F28D00] rounded-full"></div>
                  <h3 className="text-xl font-bold text-[#0f3d5e]">Signature *</h3>
                </div>
                <p className="text-sm text-slate-600">Please sign in the box below using your mouse, touchpad, or finger</p>
                <div className="border-2 border-[#0f3d5e] rounded-lg bg-white shadow-sm">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startTouchDrawing}
                    onTouchMove={touchDraw}
                    onTouchEnd={stopTouchDrawing}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={clearSignature} className="border-[#0f3d5e] text-[#0f3d5e] hover:bg-[#0f3d5e] hover:text-white">
                  Clear Signature
                </Button>
              </div>

              <div className="space-y-4 border-t-2 border-[#F28D00] pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-6 bg-[#F28D00] rounded-full"></div>
                  <h3 className="text-xl font-bold text-[#0f3d5e]">Terms and Conditions</h3>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border-l-4 border-[#0f3d5e] max-h-96 overflow-y-auto text-sm space-y-3 shadow-inner">
                  <p className="font-bold text-[#0f3d5e] text-base">Payment Terms:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Full payment is due 14 days prior to the course start date</li>
                    <li>Payment can be made by bank transfer or cheque</li>
                    <li>Purchase orders are accepted from approved accounts</li>
                  </ul>

                  <p className="font-bold text-[#0f3d5e] text-base mt-4">Cancellation Policy:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Cancellations made more than 14 days before the course: Full refund minus £50 administration fee</li>
                    <li>Cancellations made 7-14 days before the course: 50% of course fee will be charged</li>
                    <li>Cancellations made less than 7 days before the course: Full course fee will be charged</li>
                    <li>Delegates may be substituted at any time without charge</li>
                  </ul>

                  <p className="font-bold text-[#0f3d5e] text-base mt-4">Course Changes:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>We reserve the right to cancel or postpone courses due to insufficient bookings or circumstances beyond our control</li>
                    <li>In the event of cancellation by us, you will be offered an alternative date or full refund</li>
                    <li>We are not liable for any travel or accommodation costs incurred</li>
                  </ul>

                  <p className="font-bold text-[#0f3d5e] text-base mt-4">Liability:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>We accept no liability for loss or damage to delegates' personal property</li>
                    <li>Delegates attend courses at their own risk</li>
                    <li>We maintain appropriate insurance cover for our training activities</li>
                  </ul>

                  <p className="font-bold text-[#0f3d5e] text-base mt-4">Data Protection:</p>
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

              <div className="flex justify-center pt-6">
                <Button
                  type="submit"
                  disabled={submitting}
                  size="lg"
                  className="min-w-[250px] bg-gradient-to-r from-[#F9B000] to-[#F28D00] hover:from-[#F28D00] hover:to-[#F9B000] text-white font-bold text-lg py-6 shadow-lg hover:shadow-xl transition-all"
                >
                  {submitting ? 'Submitting...' : 'Submit Booking Form'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 bg-[#0f3d5e] rounded-b-2xl p-6 text-center text-white shadow-lg">
          <p className="text-sm text-slate-200">
            For any questions or assistance, please contact us at{' '}
            <a href="mailto:daniel@cpts.uk" className="text-[#F9B000] hover:text-[#F28D00] font-semibold underline">
              daniel@cpts.uk
            </a>
          </p>
          <p className="text-xs text-slate-400 mt-2">
            &copy; {new Date().getFullYear()} CPTS Training. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
