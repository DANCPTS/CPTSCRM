'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardMetrics, getTasks, getCourseRuns, getLeads } from '@/lib/db-helpers';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Link from 'next/link';
import { Calendar, CheckCircle2, TrendingUp, Users, Award, UserCheck } from 'lucide-react';
import { format, isToday, parseISO, isBefore, addDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const { userProfile } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [next7DaysTasks, setNext7DaysTasks] = useState<any[]>([]);
  const [upcomingRuns, setUpcomingRuns] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [weeklyAttendees, setWeeklyAttendees] = useState<any[]>([]);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [userProfile]);

  const loadDashboard = async () => {
    try {
      const [metricsData, tasksData, runsData, leadsData] = await Promise.all([
        getDashboardMetrics(),
        getTasks(userProfile?.id),
        getCourseRuns(),
        getLeads(),
      ]);

      setMetrics(metricsData);

      const today = new Date();
      const nextWeek = addDays(today, 7);

      const tasksOverdue = tasksData.filter((task: any) => {
        if (!task.due_date || task.status === 'done') return false;
        const dueDate = parseISO(task.due_date);
        return isBefore(dueDate, today) && !isToday(dueDate);
      });

      const tasksDueToday = tasksData.filter((task: any) => {
        if (!task.due_date || task.status === 'done') return false;
        const dueDate = parseISO(task.due_date);
        return isToday(dueDate);
      });

      const tasksDueNext7Days = tasksData.filter((task: any) => {
        if (!task.due_date || task.status === 'done') return false;
        const dueDate = parseISO(task.due_date);
        return !isToday(dueDate) && isBefore(dueDate, nextWeek) && !isBefore(dueDate, today);
      });

      setOverdueTasks(tasksOverdue);
      setTodayTasks(tasksDueToday);
      setNext7DaysTasks(tasksDueNext7Days);

      const filteredRuns = runsData.filter((run: any) => {
        const startDate = parseISO(run.start_date);
        return isBefore(today, addDays(startDate, 1)) && isBefore(startDate, nextWeek);
      });

      setUpcomingRuns(filteredRuns);
      setRecentLeads(leadsData?.slice(0, 5) || []);

      await loadWeeklyAttendees();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyAttendees = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      const { data: courseRuns, error } = await supabase
        .from('course_runs')
        .select(`
          id,
          start_date,
          end_date,
          location,
          training_days,
          test_days,
          courses (
            id,
            title
          ),
          candidate_courses (
            id,
            candidates (
              id,
              first_name,
              last_name,
              email,
              phone
            )
          )
        `)
        .gte('end_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('start_date', format(weekEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      const attendees: any[] = [];
      courseRuns?.forEach((run: any) => {
        run.candidate_courses?.forEach((cc: any) => {
          if (cc.candidates) {
            attendees.push({
              candidate: cc.candidates,
              course: run.courses,
              courseRun: {
                id: run.id,
                start_date: run.start_date,
                end_date: run.end_date,
                location: run.location,
                training_days: run.training_days,
                test_days: run.test_days
              }
            });
          }
        });
      });

      setWeeklyAttendees(attendees);
    } catch (error) {
      console.error('Failed to load weekly attendees:', error);
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-lg">Welcome back, {userProfile?.full_name}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-5 mb-8">
              <Card
                className="md:col-span-5 border-l-4 border-l-purple-500 hover:shadow-lg transition-all"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-primary flex items-center justify-between">
                    Lead Source Performance
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        <h4 className="font-semibold text-sm">Email Imported Leads (Google Ads)</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">{metrics?.emailLeads?.total || 0}</div>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{metrics?.emailLeads?.won || 0}</div>
                          <p className="text-xs text-muted-foreground">Won</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{metrics?.emailLeads?.conversion || 0}%</div>
                          <p className="text-xs text-muted-foreground">Rate</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 border-l pl-6">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <h4 className="font-semibold text-sm">Manual Leads</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">{metrics?.manualLeads?.total || 0}</div>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{metrics?.manualLeads?.won || 0}</div>
                          <p className="text-xs text-muted-foreground">Won</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{metrics?.manualLeads?.conversion || 0}%</div>
                          <p className="text-xs text-muted-foreground">Rate</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-5 mb-8">
              <Card className="border-l-4 border-l-accent hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-primary">Leads This Week</CardTitle>
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{metrics?.leadsThisWeek || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">New leads in the last 7 days</p>
                </CardContent>
              </Card>

              <Card
                className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setAttendanceDialogOpen(true)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-primary">This Week</CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{weeklyAttendees.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Candidates attending courses</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-secondary hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-primary">Conversion Rate</CardTitle>
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-secondary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{metrics?.conversionRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Leads to won ratio</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-primary">Seats Filled (30d)</CardTitle>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{metrics?.seatsFilled}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Course capacity utilization</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold text-primary">Pass Rate</CardTitle>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Award className="h-5 w-5 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{metrics?.passRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Overall candidate success rate</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
              <Card className="shadow-md hover:shadow-xl transition-shadow border-t-4 border-t-accent flex flex-col">
                <CardHeader>
                  <CardTitle className="text-primary">My Tasks</CardTitle>
                  <CardDescription>Upcoming tasks</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-1 flex flex-col">
                  <div className="flex-1 space-y-6">
                    {overdueTasks.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-red-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                          Overdue
                          <Badge className="bg-red-600 text-white">{overdueTasks.length}</Badge>
                        </h3>
                        <div className="space-y-3">
                          {overdueTasks.map((task: any) => (
                            <Link href={`/tasks?id=${task.id}`} key={task.id}>
                              <div className="flex items-start justify-between rounded-lg border-2 border-red-300 bg-red-100 p-4 hover:bg-red-200 transition-all cursor-pointer">
                                <div className="flex-1">
                                  <p className="font-semibold text-sm text-red-900">{task.title}</p>
                                  {task.due_date && (
                                    <p className="text-xs text-red-700 mt-1 font-medium">
                                      Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="destructive" className="bg-red-600">
                                  {task.status}
                                </Badge>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-bold text-red-600 mb-3 uppercase tracking-wide">Due Today</h3>
                      {todayTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No tasks due today</p>
                      ) : (
                        <div className="space-y-3">
                          {todayTasks.map((task: any) => (
                            <Link href={`/tasks?id=${task.id}`} key={task.id}>
                              <div className="flex items-start justify-between rounded-lg border-2 border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-all cursor-pointer">
                                <div className="flex-1">
                                  <p className="font-semibold text-sm text-primary">{task.title}</p>
                                  {task.due_date && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant={task.status === 'done' ? 'default' : 'secondary'}
                                  className={task.status === 'done' ? 'bg-secondary' : 'bg-accent'}
                                >
                                  {task.status}
                                </Badge>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide">Next 7 Days</h3>
                      {next7DaysTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No upcoming tasks</p>
                      ) : (
                        <div className="space-y-3">
                          {next7DaysTasks.map((task: any) => (
                            <Link href={`/tasks?id=${task.id}`} key={task.id}>
                              <div className="flex items-start justify-between rounded-lg border bg-muted/50 p-4 hover:bg-muted/70 transition-all cursor-pointer">
                                <div className="flex-1">
                                  <p className="font-semibold text-sm text-primary">{task.title}</p>
                                  {task.due_date && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant={task.status === 'done' ? 'default' : 'secondary'}
                                  className={task.status === 'done' ? 'bg-secondary' : 'bg-accent'}
                                >
                                  {task.status}
                                </Badge>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button asChild className="w-full mt-4 bg-accent hover:bg-accent/90 text-accent-foreground shadow-md">
                    <Link href="/tasks">View All Tasks</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-md hover:shadow-xl transition-shadow border-t-4 border-t-secondary flex flex-col">
                <CardHeader>
                  <CardTitle className="text-primary">Upcoming Sessions</CardTitle>
                  <CardDescription>Course runs in the next 7 days</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    {upcomingRuns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No upcoming sessions</p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingRuns.map((run: any) => (
                          <div
                            key={run.id}
                            className="flex items-start justify-between rounded-lg border bg-muted/50 p-4 hover:bg-muted/70 transition-all"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-primary">{run.courses?.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(parseISO(run.start_date), 'MMM d, yyyy')} • {run.location}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {run.seats_booked}/{run.seats_total} seats booked
                              </p>
                            </div>
                            <div className="p-2 bg-secondary/10 rounded-lg">
                              <Calendar className="h-5 w-5 text-secondary" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button asChild className="w-full mt-4 bg-accent hover:bg-accent/90 text-accent-foreground shadow-md">
                    <Link href="/runs">View All Runs</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 shadow-md hover:shadow-xl transition-shadow border-t-4 border-t-primary">
                <CardHeader>
                  <CardTitle className="text-primary">Recent Leads</CardTitle>
                  <CardDescription>Latest leads added to the system</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {recentLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leads yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentLeads.map((lead: any) => (
                        <div
                          key={lead.id}
                          className="flex items-center justify-between rounded-lg border bg-muted/50 p-4 hover:bg-muted/70 transition-all"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-primary">{lead.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {lead.company_name} • {lead.email}
                            </p>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-primary/20">{lead.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button asChild className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                    <Link href="/leads">View All Leads</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Weekly Attendance ({format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')} - {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d, yyyy')})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {weeklyAttendees.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No candidates attending courses this week
                </div>
              ) : (
                weeklyAttendees.map((attendee, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-primary">
                              {attendee.candidate.first_name} {attendee.candidate.last_name}
                            </h4>
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                              Attending
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-slate-600">
                            <p className="font-medium text-primary">
                              {attendee.course?.title}
                            </p>
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(attendee.courseRun.start_date), 'MMM d')} - {format(parseISO(attendee.courseRun.end_date), 'MMM d, yyyy')}
                            </p>
                            {attendee.courseRun.location && (
                              <p className="text-xs">📍 {attendee.courseRun.location}</p>
                            )}
                            {attendee.candidate.email && (
                              <p className="text-xs">✉️ {attendee.candidate.email}</p>
                            )}
                            {attendee.candidate.phone && (
                              <p className="text-xs">📞 {attendee.candidate.phone}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {weeklyAttendees.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button asChild className="w-full">
                  <Link href="/calendar">View Calendar</Link>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
