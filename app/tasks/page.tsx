'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, List, Calendar as CalendarIcon } from 'lucide-react';
import { getTasks } from '@/lib/db-helpers';
import { useAuth } from '@/lib/auth-context';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { TaskDialog } from '@/components/task-dialog';

type ViewMode = 'list' | 'calendar';

export default function TasksPage() {
  const { userProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadTasks();
  }, [userProfile]);

  useEffect(() => {
    const taskId = searchParams.get('id');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setTaskDialogOpen(true);
        router.replace('/tasks', { scroll: false });
      }
    }
  }, [searchParams, tasks, router]);

  const loadTasks = async () => {
    try {
      const data = await getTasks(userProfile?.id);
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'open' : 'done';
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      toast.success('Task updated');
    } catch (error: any) {
      toast.error('Failed to update task');
      console.error(error);
    }
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(parseISO(task.due_date), day);
    });
  };

  const renderCalendarView = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const startDay = monthStart.getDay();
    const totalCells = Math.ceil((days.length + startDay) / 7) * 7;
    const calendarDays = Array.from({ length: totalCells }, (_, i) => {
      const dayIndex = i - startDay;
      if (dayIndex < 0 || dayIndex >= days.length) return null;
      return days[dayIndex];
    });

    return (
      <div className="bg-card rounded-xl shadow-lg p-6">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Previous
          </Button>
          <h2 className="text-2xl font-bold text-primary">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button
            variant="outline"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Next
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center font-bold text-primary text-sm bg-muted rounded-lg">
              {day}
            </div>
          ))}

          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-32 p-3 bg-muted/30 rounded-lg" />;
            }

            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={i}
                className={`min-h-32 p-3 rounded-lg border-2 transition-all ${
                  isCurrentDay
                    ? 'border-accent bg-accent/10 shadow-md'
                    : 'border-border bg-card hover:shadow-md'
                } ${!isCurrentMonth ? 'opacity-40' : ''}`}
              >
                <div className={`text-sm font-bold mb-2 ${
                  isCurrentDay
                    ? 'text-accent bg-accent/20 rounded-full w-7 h-7 flex items-center justify-center'
                    : 'text-primary'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1.5">
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setTaskDialogOpen(true);
                      }}
                      className={`text-xs p-2 rounded-md cursor-pointer hover:shadow-lg transition-all font-medium border ${
                        task.status === 'done'
                          ? 'bg-secondary/20 text-secondary border-secondary/30 line-through hover:bg-secondary/30'
                          : task.status === 'in_progress'
                          ? 'bg-accent/20 text-accent-foreground border-accent/30 hover:bg-accent/30'
                          : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                      }`}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-primary mb-2">Tasks</h1>
            <p className="text-muted-foreground text-lg">Manage your action items and stay organized</p>
          </div>
          <div className="flex gap-3">
            <div className="flex bg-muted rounded-xl p-1.5 shadow-sm border border-border">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-primary shadow-md' : ''}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={viewMode === 'calendar' ? 'bg-primary shadow-md' : ''}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Calendar
              </Button>
            </div>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {tasks.map(task => (
              <Card
                key={task.id}
                className="hover:shadow-lg transition-all cursor-pointer border-l-4 hover:scale-[1.01] border-l-accent"
                onClick={() => {
                  setSelectedTask(task);
                  setTaskDialogOpen(true);
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={() => {
                        toggleTaskStatus(task.id, task.status);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="border-2 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                    />
                    <div className="flex-1">
                      <h3 className={`font-semibold text-lg ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                        {task.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.due_date && `Due: ${format(parseISO(task.due_date), 'MMM d, yyyy')}`}
                        {task.users && ` • Assigned to: ${task.users.full_name}`}
                      </p>
                    </div>
                    <Badge
                      variant={task.status === 'done' ? 'default' : 'secondary'}
                      className={
                        task.status === 'done'
                          ? 'bg-secondary text-secondary-foreground'
                          : task.status === 'in_progress'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          renderCalendarView()
        )}
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={selectedTask}
        onTaskUpdated={loadTasks}
      />
    </AppShell>
  );
}
