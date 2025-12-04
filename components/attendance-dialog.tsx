'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CheckCircle2, XCircle, Clock, AlertCircle, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateCourse: any;
  courseRun: any;
}

export function AttendanceDialog({ open, onOpenChange, candidateCourse, courseRun }: AttendanceDialogProps) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [theoryTestTime, setTheoryTestTime] = useState('');
  const [practicalTestTime, setPracticalTestTime] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadAttendance();
      getCurrentUser();
    }
  }, [open, candidateCourse?.id]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadAttendance = async () => {
    if (!candidateCourse?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('candidate_course_id', candidateCourse.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAttendance = async (date: string, status: string) => {
    if (!currentUserId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      const existing = attendance.find(a => a.date === date);
      const isTestDay = courseRun?.test_days?.includes(date);

      const updateData: any = {
        status,
        notes,
        updated_at: new Date().toISOString()
      };

      if (isTestDay) {
        if (theoryTestTime) {
          updateData.theory_test_time = theoryTestTime;
        }
        if (practicalTestTime) {
          updateData.practical_test_time = practicalTestTime;
        }
      }

      if (existing) {
        const { error } = await supabase
          .from('attendance')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance')
          .insert({
            candidate_course_id: candidateCourse.id,
            date,
            status,
            notes,
            theory_test_time: isTestDay && theoryTestTime ? theoryTestTime : null,
            practical_test_time: isTestDay && practicalTestTime ? practicalTestTime : null,
            marked_by: currentUserId
          });

        if (error) throw error;
      }

      toast.success('Attendance marked successfully');
      setSelectedDate(null);
      setNotes('');
      setTheoryTestTime('');
      setPracticalTestTime('');
      await loadAttendance();
    } catch (error: any) {
      toast.error(`Failed to mark attendance: ${error.message}`);
      console.error(error);
    }
  };

  const markTestResult = async (date: string, result: 'passed' | 'failed') => {
    if (!currentUserId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      const { error: candidateError } = await supabase
        .from('candidate_courses')
        .update({ result })
        .eq('id', candidateCourse.id);

      if (candidateError) throw candidateError;

      await markAttendance(date, 'present');

      toast.success(`Marked as ${result}`);
    } catch (error: any) {
      toast.error(`Failed to mark test result: ${error.message}`);
      console.error(error);
    }
  };

  const getTrainingDays = () => {
    const days = [];

    // training_days is now an array of date strings
    if (courseRun?.training_days && Array.isArray(courseRun.training_days)) {
      days.push(...courseRun.training_days);
    }

    // test_days is also an array of date strings
    if (courseRun?.test_days && Array.isArray(courseRun.test_days)) {
      days.push(...courseRun.test_days);
    }

    // Sort the days chronologically
    return days.sort();
  };

  const trainingDays = getTrainingDays();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'absent':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'late':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'excused':
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      present: 'default',
      absent: 'destructive',
      late: 'secondary',
      excused: 'outline'
    };
    return variants[status] || 'secondary';
  };

  const attendanceStats = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    excused: attendance.filter(a => a.status === 'excused').length,
    total: trainingDays.length
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance for {candidateCourse?.candidates?.first_name} {candidateCourse?.candidates?.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-3 bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">Present</span>
                <span className="text-lg font-bold text-green-900">{attendanceStats.present}</span>
              </div>
            </Card>
            <Card className="p-3 bg-red-50 border-red-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-700">Absent</span>
                <span className="text-lg font-bold text-red-900">{attendanceStats.absent}</span>
              </div>
            </Card>
            <Card className="p-3 bg-orange-50 border-orange-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-700">Late</span>
                <span className="text-lg font-bold text-orange-900">{attendanceStats.late}</span>
              </div>
            </Card>
            <Card className="p-3 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">Excused</span>
                <span className="text-lg font-bold text-blue-900">{attendanceStats.excused}</span>
              </div>
            </Card>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Course Days</h3>
            {trainingDays.length === 0 && (
              <p className="text-sm text-slate-500 italic">No course days configured for this run</p>
            )}
            <div className="space-y-2">
              {trainingDays.map((date) => {
                const record = attendance.find(a => a.date === date);
                const isSelected = selectedDate === date;
                const isTestDay = courseRun?.test_days?.includes(date);

                return (
                  <Card
                    key={date}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-slate-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {format(parseISO(date), 'EEEE, MMM d, yyyy')}
                            </span>
                            {isTestDay && (
                              <Badge variant="secondary" className="text-xs">Test Day</Badge>
                            )}
                          </div>
                          {isTestDay && (record?.theory_test_time || record?.practical_test_time) && (
                            <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                              {record?.theory_test_time && (
                                <p>Theory: {record.theory_test_time}</p>
                              )}
                              {record?.practical_test_time && (
                                <p>Practical: {record.practical_test_time}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record ? (
                          <>
                            {getStatusIcon(record.status)}
                            <Badge variant={getStatusBadge(record.status)}>
                              {record.status}
                            </Badge>
                          </>
                        ) : (
                          <Badge variant="outline">Not marked</Badge>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {isTestDay ? (
                          <>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor="theory_test_time" className="text-sm font-medium">Theory Test Time</Label>
                                  <Input
                                    id="theory_test_time"
                                    type="time"
                                    value={theoryTestTime || record?.theory_test_time || ''}
                                    onChange={(e) => setTheoryTestTime(e.target.value)}
                                    className="mt-1"
                                    placeholder="e.g., 09:00"
                                  />
                                  {record?.theory_test_time && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      Current: {record.theory_test_time}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <Label htmlFor="practical_test_time" className="text-sm font-medium">Practical Test Time</Label>
                                  <Input
                                    id="practical_test_time"
                                    type="time"
                                    value={practicalTestTime || record?.practical_test_time || ''}
                                    onChange={(e) => setPracticalTestTime(e.target.value)}
                                    className="mt-1"
                                    placeholder="e.g., 14:00"
                                  />
                                  {record?.practical_test_time && (
                                    <p className="text-xs text-slate-500 mt-1">
                                      Current: {record.practical_test_time}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="sm"
                                  variant={candidateCourse?.result === 'passed' ? 'default' : 'outline'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markTestResult(date, 'passed');
                                  }}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <Award className="mr-2 h-4 w-4" />
                                  Mark as Passed
                                </Button>
                                <Button
                                  size="sm"
                                  variant={candidateCourse?.result === 'failed' ? 'destructive' : 'outline'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markTestResult(date, 'failed');
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Mark as Failed
                                </Button>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={record?.status === 'present' ? 'default' : 'outline'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAttendance(date, 'present');
                                  }}
                                  className="flex-1"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  variant={record?.status === 'absent' ? 'destructive' : 'outline'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAttendance(date, 'absent');
                                  }}
                                  className="flex-1"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Absent
                                </Button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={record?.status === 'present' ? 'default' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAttendance(date, 'present');
                              }}
                              className="flex-1"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant={record?.status === 'absent' ? 'destructive' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAttendance(date, 'absent');
                              }}
                              className="flex-1"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Absent
                            </Button>
                            <Button
                              size="sm"
                              variant={record?.status === 'late' ? 'secondary' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAttendance(date, 'late');
                              }}
                              className="flex-1"
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              Late
                            </Button>
                            <Button
                              size="sm"
                              variant={record?.status === 'excused' ? 'secondary' : 'outline'}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAttendance(date, 'excused');
                              }}
                              className="flex-1"
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Excused
                            </Button>
                          </div>
                        )}

                        <Textarea
                          placeholder="Add notes (optional)..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="text-sm"
                          rows={2}
                        />

                        {record?.notes && (
                          <p className="text-xs text-slate-600 italic">
                            Previous note: {record.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
