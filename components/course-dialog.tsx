'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, X, Repeat, Calendar as CalendarIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CourseDialogProps {
  open: boolean;
  onClose: () => void;
  course?: any;
}

interface CourseRun {
  location: string;
  seats_total: string;
  trainer: string;
  repeat_weekly: boolean;
  repeat_interval: string;
  repeat_weeks: string;
  training_days: Date[];
  test_date: Date | undefined;
}

interface AccreditationPrice {
  accreditation: string;
  price: string;
  enabled: boolean;
}

export function CourseDialog({ open, onClose, course }: CourseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_days: '1',
    delivery_mode: 'yard',
  });

  const [accreditationPrices, setAccreditationPrices] = useState<AccreditationPrice[]>([
    { accreditation: 'CPCS', price: '', enabled: false },
    { accreditation: 'NPORS', price: '', enabled: false },
    { accreditation: 'IPAF', price: '', enabled: false },
    { accreditation: 'ETC', price: '', enabled: false },
  ]);

  const [courseRuns, setCourseRuns] = useState<CourseRun[]>([
    {
      location: '',
      seats_total: '',
      trainer: '',
      repeat_weekly: false,
      repeat_interval: '1',
      repeat_weeks: '4',
      training_days: [],
      test_date: undefined,
    },
  ]);

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title || '',
        description: course.description || '',
        duration_days: course.duration_days?.toString() || '1',
        delivery_mode: course.delivery_mode || 'yard',
      });

      if (course.id) {
        loadAccreditationPrices(course.id);
      }
      setCourseRuns([
        {
          location: '',
          seats_total: '',
          trainer: '',
          repeat_weekly: false,
          repeat_interval: '1',
          repeat_weeks: '4',
          training_days: [],
          test_date: undefined,
        },
      ]);
    } else {
      setFormData({
        title: '',
        description: '',
        duration_days: '1',
        delivery_mode: 'yard',
      });
      setAccreditationPrices([
        { accreditation: 'CPCS', price: '', enabled: false },
        { accreditation: 'NPORS', price: '', enabled: false },
        { accreditation: 'IPAF', price: '', enabled: false },
        { accreditation: 'ETC', price: '', enabled: false },
      ]);
      setCourseRuns([
        {
          location: '',
          seats_total: '',
          trainer: '',
          repeat_weekly: false,
          repeat_interval: '1',
          repeat_weeks: '4',
          training_days: [],
          test_date: undefined,
        },
      ]);
    }
  }, [course, open]);

  const loadAccreditationPrices = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('course_accreditation_pricing')
        .select('*')
        .eq('course_id', courseId);

      if (error) throw error;

      if (data && data.length > 0) {
        setAccreditationPrices([
          { accreditation: 'CPCS', price: data.find(p => p.accreditation === 'CPCS')?.price?.toString() || '', enabled: !!data.find(p => p.accreditation === 'CPCS') },
          { accreditation: 'NPORS', price: data.find(p => p.accreditation === 'NPORS')?.price?.toString() || '', enabled: !!data.find(p => p.accreditation === 'NPORS') },
          { accreditation: 'IPAF', price: data.find(p => p.accreditation === 'IPAF')?.price?.toString() || '', enabled: !!data.find(p => p.accreditation === 'IPAF') },
          { accreditation: 'ETC', price: data.find(p => p.accreditation === 'ETC')?.price?.toString() || '', enabled: !!data.find(p => p.accreditation === 'ETC') },
        ]);
      }
    } catch (error) {
      console.error('Error loading accreditation prices:', error);
    }
  };

  const updateAccreditationPrice = (accreditation: string, field: 'price' | 'enabled', value: string | boolean) => {
    setAccreditationPrices(prev =>
      prev.map(item =>
        item.accreditation === accreditation
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const addCourseRun = () => {
    setCourseRuns([
      ...courseRuns,
      {
        location: '',
        seats_total: '',
        trainer: '',
        repeat_weekly: false,
        repeat_interval: '1',
        repeat_weeks: '4',
        training_days: [],
        test_date: undefined,
      },
    ]);
  };

  const removeCourseRun = (index: number) => {
    if (courseRuns.length > 1) {
      setCourseRuns(courseRuns.filter((_, i) => i !== index));
    }
  };

  const updateCourseRun = (index: number, field: keyof CourseRun, value: string | boolean) => {
    const updated = [...courseRuns];
    if (field === 'repeat_weekly') {
      updated[index][field] = value === 'true' || value === true;
    } else {
      updated[index][field] = value as any;
    }
    setCourseRuns(updated);
  };

  const generateWeeklyRuns = (run: CourseRun, courseId: string) => {
    const runs = [];
    const weeksToGenerate = parseInt(run.repeat_weeks) || 1;
    const intervalWeeks = parseInt(run.repeat_interval) || 1;

    for (let week = 0; week < weeksToGenerate; week++) {
      const weekTrainingDays = run.training_days.map(date => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + (week * intervalWeeks * 7));
        return newDate.toISOString().split('T')[0];
      });

      let weekTestDate = null;
      if (run.test_date) {
        const testDate = new Date(run.test_date);
        testDate.setDate(run.test_date.getDate() + (week * intervalWeeks * 7));
        weekTestDate = testDate.toISOString().split('T')[0];
      }

      const minDate = weekTrainingDays[0];
      const maxDate = weekTestDate || weekTrainingDays[weekTrainingDays.length - 1];

      runs.push({
        course_id: courseId,
        start_date: minDate,
        end_date: maxDate,
        location: run.location,
        seats_total: parseInt(run.seats_total),
        seats_booked: 0,
        trainer: run.trainer || '',
        training_days: weekTrainingDays,
        test_days: weekTestDate ? [weekTestDate] : [],
      });
    }

    return runs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const enabledAccreditations = accreditationPrices.filter(a => a.enabled);

      if (enabledAccreditations.length === 0) {
        toast.error('Please select at least one accreditation');
        setLoading(false);
        return;
      }

      if (enabledAccreditations.some(a => !a.price || parseFloat(a.price) <= 0)) {
        toast.error('Please set a valid price for all enabled accreditations');
        setLoading(false);
        return;
      }

      const courseData = {
        title: formData.title,
        description: formData.description,
        duration_days: parseInt(formData.duration_days),
        delivery_mode: formData.delivery_mode,
        accreditation: enabledAccreditations.map(a => a.accreditation),
      };

      let courseId: string;

      if (course) {
        const { error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', course.id);

        if (error) throw error;
        courseId = course.id;
        toast.success('Course updated successfully');
      } else {
        const { data, error } = await supabase
          .from('courses')
          .insert([courseData])
          .select()
          .single();

        if (error) throw error;
        courseId = data.id;
        toast.success('Course created successfully');
      }

      await supabase
        .from('course_accreditation_pricing')
        .delete()
        .eq('course_id', courseId);

      const pricingData = enabledAccreditations.map(a => ({
        course_id: courseId,
        accreditation: a.accreditation,
        price: parseFloat(a.price),
      }));

      const { error: pricingError } = await supabase
        .from('course_accreditation_pricing')
        .insert(pricingData);

      if (pricingError) throw pricingError;

      const validRuns = courseRuns.filter(
        run => run.training_days.length > 0 && run.location && run.seats_total
      );

      if (validRuns.length > 0) {
        const allRunsData = [];

        for (const run of validRuns) {
          if (run.repeat_weekly) {
            const weeklyRuns = generateWeeklyRuns(run, courseId);
            allRunsData.push(...weeklyRuns);
          } else {
            const trainingDaysFormatted = run.training_days.map(date =>
              format(date, 'yyyy-MM-dd')
            );

            const testDaysFormatted = run.test_date
              ? [format(run.test_date, 'yyyy-MM-dd')]
              : [];

            const minDate = trainingDaysFormatted[0];
            const maxDate = testDaysFormatted[0] || trainingDaysFormatted[trainingDaysFormatted.length - 1];

            const runData: any = {
              course_id: courseId,
              start_date: minDate,
              end_date: maxDate,
              location: run.location,
              seats_total: parseInt(run.seats_total),
              seats_booked: 0,
              trainer: run.trainer || '',
              training_days: trainingDaysFormatted,
              test_days: testDaysFormatted,
            };

            allRunsData.push(runData);
          }
        }

        const { error: runsError } = await supabase
          .from('course_runs')
          .insert(allRunsData);

        if (runsError) throw runsError;
        toast.success(`Added ${allRunsData.length} course run(s)`);
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save course');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit Course' : 'Add New Course'}</DialogTitle>
          <DialogDescription>
            {course ? 'Update course information and add new runs' : 'Create a new training course and schedule runs'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Course Details</h3>

            <div className="space-y-2">
              <Label htmlFor="title">Course Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., IOSH Managing Safely"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Course description and key learning outcomes..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delivery_mode">Delivery Mode *</Label>
                <Select
                  value={formData.delivery_mode}
                  onValueChange={(value) => setFormData({ ...formData, delivery_mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classroom">Classroom</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="yard">Yard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_days">Duration (days) *</Label>
                <Input
                  id="duration_days"
                  type="number"
                  min="1"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-lg">Accreditation & Pricing *</h3>
            <p className="text-sm text-slate-600">Select accreditations available for this course and set individual prices (all prices plus VAT)</p>

            <div className="grid grid-cols-2 gap-4">
              {accreditationPrices.map((item) => (
                <div key={item.accreditation} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`accred_${item.accreditation}`}
                      checked={item.enabled}
                      onCheckedChange={(checked) => updateAccreditationPrice(item.accreditation, 'enabled', !!checked)}
                    />
                    <label htmlFor={`accred_${item.accreditation}`} className="text-sm font-medium cursor-pointer">
                      {item.accreditation}
                    </label>
                  </div>
                  {item.enabled && (
                    <div className="space-y-2">
                      <Label htmlFor={`price_${item.accreditation}`} className="text-xs">
                        Price per Person (plus VAT)
                      </Label>
                      <Input
                        id={`price_${item.accreditation}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateAccreditationPrice(item.accreditation, 'price', e.target.value)}
                        placeholder="0.00"
                        className="h-8"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Schedule Course Runs</h3>
              <Button type="button" variant="outline" size="sm" onClick={addCourseRun}>
                <Plus className="h-4 w-4 mr-1" />
                Add Run
              </Button>
            </div>

            <div className="space-y-4">
              {courseRuns.map((run, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                  {courseRuns.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => removeCourseRun(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="space-y-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-700">Course Schedule *</p>

                    <div className="space-y-2">
                      <Label className="text-green-700">Training Days (Green on Calendar)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !run.training_days.length && "text-slate-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {run.training_days.length > 0
                              ? `${run.training_days.length} day(s) selected`
                              : "Pick training days"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="multiple"
                            selected={run.training_days}
                            onSelect={(dates) => {
                              const updated = [...courseRuns];
                              updated[index].training_days = dates || [];
                              setCourseRuns(updated);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {run.training_days.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {run.training_days.sort((a, b) => a.getTime() - b.getTime()).map((date, i) => (
                            <span key={i} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {format(date, 'MMM d, yyyy')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-red-700">Test Day (Red on Calendar)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !run.test_date && "text-slate-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {run.test_date
                              ? format(run.test_date, 'PPP')
                              : "Pick test day (optional)"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={run.test_date}
                            onSelect={(date) => {
                              const updated = [...courseRuns];
                              updated[index].test_date = date;
                              setCourseRuns(updated);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`location_${index}`}>Location</Label>
                      <Input
                        id={`location_${index}`}
                        value={run.location}
                        onChange={(e) => updateCourseRun(index, 'location', e.target.value)}
                        placeholder="e.g., London"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`seats_total_${index}`}>Max Candidates</Label>
                      <Input
                        id={`seats_total_${index}`}
                        type="number"
                        min="1"
                        value={run.seats_total}
                        onChange={(e) => updateCourseRun(index, 'seats_total', e.target.value)}
                        placeholder="12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`trainer_${index}`}>Trainer</Label>
                      <Input
                        id={`trainer_${index}`}
                        value={run.trainer}
                        onChange={(e) => updateCourseRun(index, 'trainer', e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`repeat_${index}`}
                        checked={run.repeat_weekly}
                        onCheckedChange={(checked) => updateCourseRun(index, 'repeat_weekly', checked.toString())}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Repeat className="h-4 w-4 text-slate-600" />
                          <label htmlFor={`repeat_${index}`} className="text-sm font-medium cursor-pointer">
                            Repeat this run
                          </label>
                        </div>
                        {run.repeat_weekly && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`repeat_interval_${index}`} className="text-xs text-slate-600 whitespace-nowrap">
                                Repeat every
                              </Label>
                              <Select
                                value={run.repeat_interval}
                                onValueChange={(value) => updateCourseRun(index, 'repeat_interval', value)}
                              >
                                <SelectTrigger className="w-32 h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 week</SelectItem>
                                  <SelectItem value="2">2 weeks</SelectItem>
                                  <SelectItem value="3">3 weeks</SelectItem>
                                  <SelectItem value="4">4 weeks</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`repeat_weeks_${index}`} className="text-xs text-slate-600 whitespace-nowrap">
                                Number of runs
                              </Label>
                              <Input
                                id={`repeat_weeks_${index}`}
                                type="number"
                                min="1"
                                max="52"
                                value={run.repeat_weeks}
                                onChange={(e) => updateCourseRun(index, 'repeat_weeks', e.target.value)}
                                className="w-20 h-8 text-sm"
                              />
                              <span className="text-xs text-slate-600">
                                (will create {run.repeat_weeks} runs)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : course ? 'Update Course' : 'Create Course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
