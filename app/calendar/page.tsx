'use client';

import { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Trash2, CreditCard as Edit2, X, Users, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { AttendanceDialog } from '@/components/attendance-dialog';

interface TrainingSession {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  color: string;
  training_type?: string;
  location?: string;
  capacity?: number;
  enrolled_count: number;
  status: string;
  notes?: string;
  specific_dates?: string[];
  runId?: string;
}

const colors = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500 hover:bg-blue-600' },
  { value: 'green', label: 'Green', class: 'bg-green-500 hover:bg-green-600' },
  { value: 'red', label: 'Red', class: 'bg-red-500 hover:bg-red-600' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500 hover:bg-purple-600' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500 hover:bg-orange-600' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500 hover:bg-pink-600' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500 hover:bg-yellow-600' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500 hover:bg-teal-600' },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [courseRunDialogOpen, setCourseRunDialogOpen] = useState(false);
  const [selectedRunCandidates, setSelectedRunCandidates] = useState<any[]>([]);
  const [selectedRunDetails, setSelectedRunDetails] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('candidates');
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedCandidateCourse, setSelectedCandidateCourse] = useState<any>(null);
  const [courseRunFormData, setCourseRunFormData] = useState({
    location: '',
    trainer_id: '',
    tester_id: '',
    seats_total: '',
    training_days: [] as string[],
    test_days: [] as string[],
  });
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    color: 'blue',
    training_type: '',
    location: '',
    capacity: '',
    notes: '',
  });
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({
    training: 'green',
    theory_test: 'orange',
    practical_test: 'red',
    assessment: 'blue',
    other: 'blue',
  });

  useEffect(() => {
    loadCalendarColors();
    loadUsers();
  }, []);

  useEffect(() => {
    loadSessions();
  }, [currentDate, calendarColors]);

  const loadCalendarColors = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_settings')
        .select('*');

      if (error) throw error;

      const colorMap: Record<string, string> = {
        training: 'green',
        theory_test: 'orange',
        practical_test: 'red',
        assessment: 'blue',
        other: 'blue',
      };

      if (data && data.length > 0) {
        data.forEach((setting: any) => {
          colorMap[setting.category] = setting.color;
        });
      }

      setCalendarColors(colorMap);
    } catch (error: any) {
      console.error('Failed to load calendar colors:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('trainers')
        .select('id, first_name, last_name, is_active')
        .eq('is_active', true)
        .order('last_name');

      if (error) throw error;

      const formattedTrainers = (data || []).map(trainer => ({
        id: trainer.id,
        full_name: `${trainer.first_name} ${trainer.last_name}`,
      }));

      setAllUsers(formattedTrainers);
    } catch (error: any) {
      console.error('Failed to load trainers:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      const [trainingSessions, courseRuns] = await Promise.all([
        supabase
          .from('training_sessions')
          .select('*')
          .gte('start_date', format(start, 'yyyy-MM-dd'))
          .lte('end_date', format(end, 'yyyy-MM-dd'))
          .order('start_date', { ascending: true }),
        supabase
          .from('course_runs')
          .select('*, courses(title), trainer:trainers!trainer_id(first_name, last_name), tester:trainers!tester_id(first_name, last_name)')
          .gte('start_date', format(start, 'yyyy-MM-dd'))
          .lte('end_date', format(end, 'yyyy-MM-dd'))
          .order('start_date', { ascending: true })
      ]);

      if (trainingSessions.error) throw trainingSessions.error;
      if (courseRuns.error) throw courseRuns.error;

      // Transform course runs into training and test day entries
      const transformedCourseRuns: any[] = [];

      (courseRuns.data || []).forEach(run => {
        const hasTrainingDays = run.training_days && run.training_days.length > 0;
        const hasTestDays = run.test_days && run.test_days.length > 0;

        if (hasTrainingDays || hasTestDays) {
          // If training_days are specified, create an entry for training days
          if (hasTrainingDays) {
            const trainingStart = run.training_days[0];
            const trainingEnd = run.training_days[run.training_days.length - 1];

            const trainerName = run.trainer ? `${run.trainer.first_name} ${run.trainer.last_name}` : 'No trainer assigned';
            transformedCourseRuns.push({
              id: `${run.id}-training`,
              runId: run.id,
              course_run_id: run.id,
              title: `${run.courses?.title || 'Course'} - Training`,
              description: `${run.location} - ${trainerName}`,
              start_date: trainingStart,
              end_date: trainingEnd,
              specific_dates: run.training_days,
              start_time: '',
              end_time: '',
              color: calendarColors.training || 'green',
              training_type: 'Training Days',
              location: run.location,
              capacity: run.seats_total,
              enrolled_count: run.seats_booked || 0,
              status: 'scheduled',
              notes: '',
            });
          }

          // If test_days are specified, create an entry for test days
          if (hasTestDays) {
            const testStart = run.test_days[0];
            const testEnd = run.test_days[run.test_days.length - 1];

            const testerName = run.tester ? `${run.tester.first_name} ${run.tester.last_name}` : 'No tester assigned';
            transformedCourseRuns.push({
              id: `${run.id}-test`,
              runId: run.id,
              course_run_id: run.id,
              title: `${run.courses?.title || 'Course'} - Test`,
              description: `${run.location} - ${testerName}`,
              start_date: testStart,
              end_date: testEnd,
              specific_dates: run.test_days,
              start_time: '',
              end_time: '',
              color: calendarColors.practical_test || 'red',
              training_type: 'Test Days',
              location: run.location,
              capacity: run.seats_total,
              enrolled_count: run.seats_booked || 0,
              status: 'scheduled',
              notes: '',
            });
          }
        } else {
          // Fallback: show as single entry if no specific days
          const trainerName = run.trainer ? `${run.trainer.first_name} ${run.trainer.last_name}` : 'No trainer assigned';
          transformedCourseRuns.push({
            id: run.id,
            runId: run.id,
            course_run_id: run.id,
            title: run.courses?.title || 'Course Run',
            description: `${run.location} - ${trainerName}`,
            start_date: run.start_date,
            end_date: run.end_date,
            start_time: '',
            end_time: '',
            color: calendarColors.training || 'green',
            training_type: 'Course Run',
            location: run.location,
            capacity: run.seats_total,
            enrolled_count: run.seats_booked || 0,
            status: 'scheduled',
            notes: '',
          });
        }
      });

      setSessions([...(trainingSessions.data || []), ...transformedCourseRuns]);
    } catch (error: any) {
      toast.error('Failed to load training sessions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };


  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getCalendarWeeks = () => {
    const days = getDaysInMonth();
    const startDay = days[0].getDay();
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    // Add empty days for the start of the first week
    for (let i = 0; i < startDay; i++) {
      currentWeek.push(new Date(0)); // Placeholder for empty day
    }

    // Add all days
    days.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    // Add remaining days to last week if needed
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(new Date(0)); // Placeholder for empty day
      }
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const getSessionsForWeek = (week: Date[]) => {
    const validDays = week.filter(day => day.getTime() !== 0);
    if (validDays.length === 0) return [];

    const weekSessions = sessions.filter(session => {
      const sessionStart = parseISO(session.start_date);
      const sessionEnd = parseISO(session.end_date);

      // Check if session overlaps with this week
      return validDays.some(day =>
        isWithinInterval(day, { start: sessionStart, end: sessionEnd }) ||
        (session.specific_dates && session.specific_dates.some((date: string) =>
          isSameDay(parseISO(date), day)
        ))
      );
    });

    // Assign row positions to avoid overlaps
    const sessionsWithRows: any[] = weekSessions.map(session => {
      const position = getSessionPosition(session, week);
      return { ...session, position, row: 0 };
    });

    // Sort by start column
    sessionsWithRows.sort((a, b) => a.position.startCol - b.position.startCol);

    // Assign rows
    const rows: any[][] = [];
    sessionsWithRows.forEach(session => {
      let assignedRow = -1;

      // Try to find a row where this session doesn't overlap
      for (let i = 0; i < rows.length; i++) {
        const hasOverlap = rows[i].some(existingSession => {
          const existing = existingSession.position;
          const current = session.position;
          return !(current.endCol < existing.startCol || current.startCol > existing.endCol);
        });

        if (!hasOverlap) {
          assignedRow = i;
          break;
        }
      }

      // If no suitable row found, create a new one
      if (assignedRow === -1) {
        assignedRow = rows.length;
        rows.push([]);
      }

      session.row = assignedRow;
      rows[assignedRow].push(session);
    });

    return sessionsWithRows;
  };

  const getSessionPosition = (session: TrainingSession, week: Date[]) => {
    const sessionStart = parseISO(session.start_date);
    const sessionEnd = parseISO(session.end_date);

    let startCol = -1;
    let endCol = -1;

    week.forEach((day, index) => {
      if (day.getTime() === 0) return;

      const isInSession = session.specific_dates && session.specific_dates.length > 0
        ? session.specific_dates.some((date: string) => isSameDay(parseISO(date), day))
        : isWithinInterval(day, { start: sessionStart, end: sessionEnd });

      if (isInSession) {
        if (startCol === -1) startCol = index;
        endCol = index;
      }
    });

    return { startCol, endCol, span: endCol - startCol + 1 };
  };

  const handleCreateSession = () => {
    setSelectedSession(null);
    setFormData({
      title: '',
      description: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '',
      end_time: '',
      color: 'blue',
      training_type: '',
      location: '',
      capacity: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleEditSession = (session: TrainingSession) => {
    setSelectedSession(session);
    setFormData({
      title: session.title,
      description: session.description || '',
      start_date: session.start_date,
      end_date: session.end_date,
      start_time: session.start_time || '',
      end_time: session.end_time || '',
      color: session.color,
      training_type: session.training_type || '',
      location: session.location || '',
      capacity: session.capacity?.toString() || '',
      notes: session.notes || '',
    });
    setDialogOpen(true);
  };

  const handleViewCourseRun = async (session: TrainingSession) => {
    if (!session.runId) {
      handleEditSession(session);
      return;
    }

    await loadCandidatesForCourseRun(session);
  };

  const loadCandidatesForCourseRun = async (session: TrainingSession) => {
    try {
      const { data, error } = await supabase
        .from('candidate_courses')
        .select(`
          *,
          candidates(id, first_name, last_name, email, phone, date_of_birth, national_insurance_number),
          course_runs(id, start_date, end_date, location, trainer_id, tester_id, seats_total, seats_booked, training_days, test_days)
        `)
        .eq('course_run_id', session.runId)
        .order('enrollment_date', { ascending: false });

      if (error) throw error;

      const candidatesWithTestTimes = await Promise.all(
        (data || []).map(async (candidateCourse) => {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('date, theory_test_time, practical_test_time')
            .eq('candidate_course_id', candidateCourse.id)
            .not('theory_test_time', 'is', null)
            .or('practical_test_time.not.is.null')
            .order('date', { ascending: true });

          return {
            ...candidateCourse,
            testTimes: attendanceData || []
          };
        })
      );

      setSelectedRunCandidates(candidatesWithTestTimes);
      setSelectedRunDetails(session);

      if (data && data.length > 0 && data[0].course_runs) {
        const courseRun = data[0].course_runs;
        setCourseRunFormData({
          location: courseRun.location || '',
          trainer_id: courseRun.trainer_id || '',
          tester_id: courseRun.tester_id || '',
          seats_total: courseRun.seats_total?.toString() || '',
          training_days: courseRun.training_days || [],
          test_days: courseRun.test_days || [],
        });
      }

      setActiveTab('candidates');
      setCourseRunDialogOpen(true);
    } catch (error: any) {
      toast.error('Failed to load enrolled candidates');
      console.error(error);
    }
  };

  const handleRemoveCandidate = (candidateCourse: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setCandidateToRemove(candidateCourse);
    setDeleteDialogOpen(true);
  };

  const confirmRemoveCandidate = async () => {
    if (!candidateToRemove) return;

    try {
      const { error } = await supabase
        .from('candidate_courses')
        .delete()
        .eq('id', candidateToRemove.id);

      if (error) throw error;

      toast.success('Candidate removed from course');
      setDeleteDialogOpen(false);
      setCandidateToRemove(null);

      if (selectedRunDetails) {
        await loadCandidatesForCourseRun(selectedRunDetails);
      }
      await loadSessions();
    } catch (error: any) {
      toast.error('Failed to remove candidate');
      console.error(error);
    }
  };

  const handleSaveCourseRunSettings = async () => {
    if (!selectedRunDetails?.runId) return;

    try {
      const { error } = await supabase
        .from('course_runs')
        .update({
          location: courseRunFormData.location,
          trainer_id: courseRunFormData.trainer_id || null,
          tester_id: courseRunFormData.tester_id || null,
          seats_total: courseRunFormData.seats_total ? parseInt(courseRunFormData.seats_total) : null,
          training_days: courseRunFormData.training_days,
          test_days: courseRunFormData.test_days,
        })
        .eq('id', selectedRunDetails.runId);

      if (error) throw error;

      toast.success('Course run settings updated');
      await loadSessions();
      if (selectedRunDetails) {
        await loadCandidatesForCourseRun(selectedRunDetails);
      }
    } catch (error: any) {
      toast.error('Failed to update course run settings');
      console.error(error);
    }
  };

  const handleSaveSession = async () => {
    if (!formData.title || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const sessionData = {
        title: formData.title,
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        color: formData.color,
        training_type: formData.training_type || null,
        location: formData.location || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        notes: formData.notes || null,
      };

      if (selectedSession) {
        const { error } = await supabase
          .from('training_sessions')
          .update(sessionData)
          .eq('id', selectedSession.id);

        if (error) throw error;
        toast.success('Training session updated');
      } else {
        const { error } = await supabase
          .from('training_sessions')
          .insert([{ ...sessionData, created_by: user.id }]);

        if (error) throw error;
        toast.success('Training session created');
      }

      setDialogOpen(false);
      loadSessions();
    } catch (error: any) {
      toast.error('Failed to save training session');
      console.error(error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this training session?')) return;

    try {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      toast.success('Training session deleted');
      loadSessions();
    } catch (error: any) {
      toast.error('Failed to delete training session');
      console.error(error);
    }
  };

  const weeks = getCalendarWeeks();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Training Calendar</h1>
            <p className="text-slate-600 mt-1">Manage your training sessions</p>
          </div>
          <Button onClick={handleCreateSession}>
            <Plus className="mr-2 h-4 w-4" />
            Add Training Session
          </Button>
        </div>

        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold min-w-[200px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <Button variant="outline" size="sm" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
                  -
                </Button>
                <span className="text-sm font-medium min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
                  +
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setZoom(1); }}>
                  Reset
                </Button>
              </div>
              <Button variant="outline" onClick={handleToday}>
                Today
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
            </div>
          ) : (
            <div
              ref={calendarRef}
              className="border rounded-lg bg-white relative"
            >
              <div className="min-w-full">
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: '100%',
                    minWidth: '100%'
                  }}
                >
                  <div className="grid grid-cols-7 bg-slate-50 border-b">
                    {weekDays.map(day => (
                      <div key={day} className="p-3 text-center font-semibold text-sm text-slate-700 border-r last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>
                      {weeks.map((week, weekIndex) => {
                    const weekSessions = getSessionsForWeek(week);
                    const maxRow = Math.max(0, ...weekSessions.map((s: any) => s.row || 0));
                    const minHeight = 120 + (maxRow * 78);

                    return (
                      <div key={weekIndex} className="relative">
                        <div className="grid grid-cols-7">
                      {week.map((day, dayIndex) => {
                        const isEmpty = day.getTime() === 0;
                        const isToday = !isEmpty && isSameDay(day, new Date());
                        return (
                          <div
                            key={dayIndex}
                            className={`border-r border-b p-3 ${
                              isEmpty ? 'bg-slate-50' : !isSameMonth(day, currentDate) ? 'bg-slate-50' : 'bg-white'
                            } ${isToday ? 'bg-blue-50' : ''}`}
                            style={{ minHeight: `${minHeight}px` }}
                          >
                            {!isEmpty && (
                              <div className={`text-base font-medium ${isToday ? 'text-blue-600' : 'text-slate-700'} inline-flex items-center justify-center`}>
                                {isToday ? (
                                  <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-blue-600 bg-white">
                                    {format(day, 'd')}
                                  </span>
                                ) : (
                                  format(day, 'd')
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  {/* Event bars overlay */}
                  <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ paddingTop: '40px' }}>
                    {getSessionsForWeek(week).map((session: any) => {
                      const { startCol, endCol, span } = session.position;
                      if (startCol === -1) return null;

                      const colorClass = colors.find(c => c.value === session.color)?.class || 'bg-blue-500';
                      const cellWidth = 100 / 7;
                      const left = startCol * cellWidth;
                      const width = span * cellWidth;
                      const rowHeight = 70;
                      const rowGap = 8;
                      const top = 40 + (session.row * (rowHeight + rowGap));

                      const fontSize = span === 1 ? 10 : span === 2 ? 12 : 13;
                      const titleSize = span === 1 ? 11 : span === 2 ? 13 : 14;
                      const padding = span === 1 ? '6px 8px' : span === 2 ? '8px 10px' : '10px 12px';
                      const badgeSize = span === 1 ? 8 : span === 2 ? 9 : 10;

                      return (
                        <div
                          key={`${session.id}-${weekIndex}`}
                          className={`absolute text-white rounded cursor-pointer ${colorClass} pointer-events-auto shadow-sm overflow-hidden`}
                          style={{
                            left: `${left}%`,
                            width: `calc(${width}% - 8px)`,
                            marginLeft: '4px',
                            top: `${top}px`,
                            height: `${rowHeight}px`,
                            padding: padding,
                          }}
                          onClick={() => handleViewCourseRun(session)}
                          title={`${session.title}${session.description ? ' - ' + session.description : ''}`}
                        >
                          {session.capacity && (
                            <div
                              className="absolute top-1.5 right-1.5 font-semibold bg-black bg-opacity-20 px-1.5 py-0.5 rounded"
                              style={{ fontSize: `${badgeSize}px` }}
                            >
                              {session.enrolled_count || 0}/{session.capacity}
                            </div>
                          )}
                          <div className="flex flex-col h-full justify-center" style={{ gap: '4px' }}>
                            <div className="font-semibold leading-snug" style={{
                              fontSize: `${titleSize}px`,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              wordBreak: 'break-word'
                            }}>
                              {session.title}
                            </div>
                            {session.description && span > 1 && (
                              <div className="opacity-95 leading-snug" style={{
                                fontSize: `${fontSize}px`,
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                wordBreak: 'break-word'
                              }}>
                                {session.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedSession ? 'Edit Training Session' : 'Create Training Session'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., CPCS A09 - Forward Tipping Dumper"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details about the training"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="color">Color</Label>
                <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="training_type">Training Type</Label>
                <Input
                  id="training_type"
                  value={formData.training_type}
                  onChange={(e) => setFormData({ ...formData, training_type: e.target.value })}
                  placeholder="e.g., CPCS, NPORS, CSCS"
                />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Training location"
                />
              </div>

              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="Maximum number of participants"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveSession} className="flex-1">
                  {selectedSession ? 'Update' : 'Create'} Training Session
                </Button>
                {selectedSession && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDeleteSession(selectedSession.id);
                      setDialogOpen(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={courseRunDialogOpen} onOpenChange={setCourseRunDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedRunDetails?.title}
              </DialogTitle>
              <div className="text-sm text-slate-600 mt-2">
                {selectedRunDetails && (
                  <div>
                    <p>{format(parseISO(selectedRunDetails.start_date), 'MMM d')} - {format(parseISO(selectedRunDetails.end_date), 'MMM d, yyyy')}</p>
                    <p>{selectedRunDetails.location}</p>
                    <p className="font-semibold mt-1">
                      {selectedRunDetails.enrolled_count || 0} / {selectedRunDetails.capacity} seats filled (active enrollments only)
                    </p>
                  </div>
                )}
              </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="candidates">
                  <Users className="h-4 w-4 mr-2" />
                  Candidates ({selectedRunCandidates.filter((c: any) => c.status === 'enrolled').length} active, {selectedRunCandidates.length} total)
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Course Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="candidates" className="space-y-3 mt-4">
                {selectedRunCandidates.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No candidates enrolled yet for this course run
                  </div>
                ) : (
                  selectedRunCandidates.map((candidateCourse) => {
                    const isCancelled = candidateCourse.status === 'cancelled';
                    return (
                      <Card key={candidateCourse.id} className={isCancelled ? 'opacity-60 bg-slate-50' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className={`font-semibold ${isCancelled ? 'text-slate-500 line-through' : ''}`}>
                                  {candidateCourse.candidates?.first_name} {candidateCourse.candidates?.last_name}
                                </h4>
                                {isCancelled ? (
                                  <Badge variant="secondary" className="bg-slate-400 text-white">
                                    Cancelled
                                  </Badge>
                                ) : (
                                  <Badge variant={candidateCourse.status === 'enrolled' ? 'default' : 'secondary'}>
                                    {candidateCourse.status}
                                  </Badge>
                                )}
                                {candidateCourse.result && candidateCourse.result !== 'pending' && !isCancelled && (
                                  <Badge
                                    className={candidateCourse.result === 'passed'
                                      ? 'bg-green-600 hover:bg-green-700 text-white'
                                      : 'bg-red-600 hover:bg-red-700 text-white'
                                    }
                                  >
                                    {candidateCourse.result}
                                  </Badge>
                                )}
                              </div>
                              <div className={`text-sm mt-1 ${isCancelled ? 'text-slate-400' : 'text-slate-500'}`}>
                                {candidateCourse.candidates?.email && <p>{candidateCourse.candidates.email}</p>}
                                {candidateCourse.candidates?.phone && <p>{candidateCourse.candidates.phone}</p>}
                                {candidateCourse.candidates?.date_of_birth && (
                                  <p>DOB: {format(parseISO(candidateCourse.candidates.date_of_birth), 'MMM d, yyyy')}</p>
                                )}
                                {candidateCourse.candidates?.national_insurance_number && (
                                  <p>NI: {candidateCourse.candidates.national_insurance_number}</p>
                                )}
                                <p className="text-xs mt-1">
                                  Enrolled: {format(parseISO(candidateCourse.enrollment_date), 'MMM d, yyyy')}
                                </p>
                                {!isCancelled && candidateCourse.testTimes && candidateCourse.testTimes.length > 0 && (
                                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                    <p className="text-xs font-semibold text-blue-900 mb-1">Test Times:</p>
                                    {candidateCourse.testTimes.map((testTime: any, idx: number) => (
                                      <div key={idx} className="text-xs text-blue-800">
                                        <span className="font-medium">{format(parseISO(testTime.date), 'MMM d, yyyy')}:</span>
                                        {testTime.theory_test_time && (
                                          <span className="ml-2">Theory: {testTime.theory_test_time}</span>
                                        )}
                                        {testTime.practical_test_time && (
                                          <span className="ml-2">Practical: {testTime.practical_test_time}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!isCancelled && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCandidateCourse(candidateCourse);
                                      setAttendanceDialogOpen(true);
                                    }}
                                    title="Mark attendance"
                                  >
                                    <Users className="h-4 w-4 mr-1" />
                                    Attendance
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleRemoveCandidate(candidateCourse, e)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Remove from course"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="course_location">Location</Label>
                    <Input
                      id="course_location"
                      value={courseRunFormData.location}
                      onChange={(e) => setCourseRunFormData({ ...courseRunFormData, location: e.target.value })}
                      placeholder="Training location"
                    />
                  </div>

                  <div>
                    <Label htmlFor="course_trainer">Trainer (for Training Days)</Label>
                    <Select
                      value={courseRunFormData.trainer_id || 'none'}
                      onValueChange={(value) => setCourseRunFormData({ ...courseRunFormData, trainer_id: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trainer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No trainer assigned</SelectItem>
                        {allUsers.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="course_tester">Tester (for Test Days)</Label>
                    <Select
                      value={courseRunFormData.tester_id || 'none'}
                      onValueChange={(value) => setCourseRunFormData({ ...courseRunFormData, tester_id: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No tester assigned</SelectItem>
                        {allUsers.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="course_seats_total">Total Seats</Label>
                    <Input
                      id="course_seats_total"
                      type="number"
                      value={courseRunFormData.seats_total}
                      onChange={(e) => setCourseRunFormData({ ...courseRunFormData, seats_total: e.target.value })}
                      placeholder="Maximum capacity"
                    />
                  </div>

                  {selectedRunCandidates.length > 0 && selectedRunCandidates[0].course_runs && (
                    <div>
                      <Label className="text-sm font-semibold">Seats Booked (Read-only)</Label>
                      <p className="text-sm text-slate-600">{selectedRunCandidates[0].course_runs.seats_booked || 0}</p>
                    </div>
                  )}

                  <div>
                    <Label>Training Days</Label>
                    <div className="space-y-2 mt-2">
                      {courseRunFormData.training_days.map((day, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            type="date"
                            value={day}
                            onChange={(e) => {
                              const newDays = [...courseRunFormData.training_days];
                              newDays[index] = e.target.value;
                              setCourseRunFormData({ ...courseRunFormData, training_days: newDays });
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newDays = courseRunFormData.training_days.filter((_, i) => i !== index);
                              setCourseRunFormData({ ...courseRunFormData, training_days: newDays });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCourseRunFormData({
                            ...courseRunFormData,
                            training_days: [...courseRunFormData.training_days, format(new Date(), 'yyyy-MM-dd')]
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Training Day
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Test Days</Label>
                    <div className="space-y-2 mt-2">
                      {courseRunFormData.test_days.map((day, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            type="date"
                            value={day}
                            onChange={(e) => {
                              const newDays = [...courseRunFormData.test_days];
                              newDays[index] = e.target.value;
                              setCourseRunFormData({ ...courseRunFormData, test_days: newDays });
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newDays = courseRunFormData.test_days.filter((_, i) => i !== index);
                              setCourseRunFormData({ ...courseRunFormData, test_days: newDays });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCourseRunFormData({
                            ...courseRunFormData,
                            test_days: [...courseRunFormData.test_days, format(new Date(), 'yyyy-MM-dd')]
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Test Day
                      </Button>
                    </div>
                  </div>

                  <Button onClick={handleSaveCourseRunSettings} className="w-full">
                    Save Course Settings
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Candidate from Course</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove{' '}
                <strong>
                  {candidateToRemove?.candidates?.first_name} {candidateToRemove?.candidates?.last_name}
                </strong>
                {' '}from this course? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemoveCandidate}
                className="bg-red-600 hover:bg-red-700"
              >
                Remove Candidate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AttendanceDialog
          open={attendanceDialogOpen}
          onOpenChange={(open) => {
            setAttendanceDialogOpen(open);
            if (!open && selectedRunDetails) {
              loadCandidatesForCourseRun(selectedRunDetails);
            }
          }}
          candidateCourse={selectedCandidateCourse}
          courseRun={selectedCandidateCourse?.course_runs}
        />
      </div>
    </AppShell>
  );
}
