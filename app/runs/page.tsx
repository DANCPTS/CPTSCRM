'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar as CalendarIcon, Trash2, CheckSquare, Square, Filter } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { getCourseRuns } from '@/lib/db-helpers';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [runToDelete, setRunToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>('all');

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      const data = await getCourseRuns();
      setRuns(data);
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (run: any) => {
    setRunToDelete(run);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!runToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('course_runs')
        .delete()
        .eq('id', runToDelete.id);

      if (error) throw error;

      toast.success('Course run deleted successfully');
      setRuns(runs.filter(r => r.id !== runToDelete.id));
      setDeleteDialogOpen(false);
      setRunToDelete(null);
    } catch (error: any) {
      toast.error(`Failed to delete course run: ${error.message}`);
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectRun = (runId: string) => {
    const newSelected = new Set(selectedRuns);
    if (newSelected.has(runId)) {
      newSelected.delete(runId);
    } else {
      newSelected.add(runId);
    }
    setSelectedRuns(newSelected);
  };

  const filteredRuns = filterCourse === 'all'
    ? runs
    : runs.filter(run => run.course_id === filterCourse);

  const uniqueCourses = Array.from(
    new Map(runs.map(run => [run.course_id, run.courses])).values()
  );

  const toggleSelectAll = () => {
    if (selectedRuns.size === filteredRuns.length) {
      setSelectedRuns(new Set());
    } else {
      setSelectedRuns(new Set(filteredRuns.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRuns.size === 0) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('course_runs')
        .delete()
        .in('id', Array.from(selectedRuns));

      if (error) throw error;

      toast.success(`${selectedRuns.size} course run(s) deleted successfully`);
      setRuns(runs.filter(r => !selectedRuns.has(r.id)));
      setSelectedRuns(new Set());
      setBulkDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(`Failed to delete course runs: ${error.message}`);
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Course Runs</h1>
            <p className="text-slate-600 mt-1">Scheduled training sessions</p>
          </div>
          <div className="flex gap-2">
            {selectedRuns.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {selectedRuns.size} Selected
              </Button>
            )}
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Schedule Run
            </Button>
          </div>
        </div>

        {!loading && runs.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-600" />
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses ({runs.length})</SelectItem>
                  {uniqueCourses.map((course: any) => {
                    const count = runs.filter(r => r.course_id === course?.id).length;
                    return (
                      <SelectItem key={course?.id} value={course?.id}>
                        {course?.title} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="h-6 w-px bg-slate-300" />

            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
            >
              {selectedRuns.size === filteredRuns.length && filteredRuns.length > 0 ? (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Select All
                </>
              )}
            </Button>
            {selectedRuns.size > 0 && (
              <span className="text-sm text-slate-600">
                {selectedRuns.size} of {filteredRuns.length} selected
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-600">No runs found for this course</p>
            <Button
              variant="link"
              onClick={() => setFilterCourse('all')}
              className="mt-2"
            >
              Clear filter
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRuns.map(run => (
              <Card
                key={run.id}
                className={`hover:shadow-sm transition-shadow ${
                  selectedRuns.has(run.id) ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedRuns.has(run.id)}
                      onCheckedChange={() => toggleSelectRun(run.id)}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CalendarIcon className="h-5 w-5 text-slate-600" />
                          <h3 className="font-semibold">{run.courses?.title}</h3>
                        </div>
                        <p className="text-sm text-slate-600">
                          {format(parseISO(run.start_date), 'MMM d, yyyy')} - {format(parseISO(run.end_date), 'MMM d, yyyy')}
                          {' • '}
                          {run.location}
                          {run.trainer && ` • Trainer: ${run.trainer}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge
                            variant={run.seats_booked >= run.seats_total ? 'default' : 'secondary'}
                          >
                            {run.seats_booked}/{run.seats_total} seats
                          </Badge>
                          <p className="text-xs text-slate-600 mt-1">
                            {run.seats_total - run.seats_booked} available
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(run)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course Run?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this course run?
              {runToDelete && (
                <div className="mt-2 p-3 bg-slate-50 rounded text-sm text-slate-900">
                  <strong>{runToDelete.courses?.title}</strong>
                  <br />
                  {format(parseISO(runToDelete.start_date), 'MMM d, yyyy')} - {format(parseISO(runToDelete.end_date), 'MMM d, yyyy')}
                  <br />
                  {runToDelete.location}
                  {runToDelete.seats_booked > 0 && (
                    <div className="mt-2 text-red-600 font-medium">
                      Warning: {runToDelete.seats_booked} candidate(s) are enrolled in this run.
                    </div>
                  )}
                </div>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedRuns.size} Course Runs?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedRuns.size} course run(s)? This action cannot be undone.
              {(() => {
                const selectedRunsList = runs.filter(r => selectedRuns.has(r.id));
                const totalEnrolled = selectedRunsList.reduce((sum, r) => sum + (r.seats_booked || 0), 0);
                return totalEnrolled > 0 ? (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    <strong>Warning:</strong> {totalEnrolled} candidate(s) are enrolled across these runs.
                  </div>
                ) : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : `Delete ${selectedRuns.size} Runs`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
