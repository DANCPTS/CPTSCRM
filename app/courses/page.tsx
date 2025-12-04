'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CourseDialog } from '@/components/course-dialog';
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

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<any>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const { data: coursesData, error } = await supabase
        .from('courses')
        .select('*')
        .order('title');

      if (error) throw error;

      const coursesWithPricing = await Promise.all(
        (coursesData || []).map(async (course) => {
          const { data: pricing } = await supabase
            .from('course_accreditation_pricing')
            .select('*')
            .eq('course_id', course.id);

          return {
            ...course,
            pricing: pricing || [],
          };
        })
      );

      setCourses(coursesWithPricing);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, course: any) => {
    e.stopPropagation();
    setCourseToDelete(course);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!courseToDelete) return;

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseToDelete.id);

      if (error) throw error;

      toast.success('Course deleted successfully');
      loadCourses();
    } catch (error: any) {
      console.error('Failed to delete course:', error);
      toast.error('Failed to delete course');
    } finally {
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Courses</h1>
            <p className="text-slate-600 mt-1">Training course catalog</p>
          </div>
          <Button onClick={() => {
            setSelectedCourse(null);
            setDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Course
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => (
              <Card
                key={course.id}
                className="hover:shadow-md transition-shadow cursor-pointer relative group"
                onClick={() => {
                  setSelectedCourse(course);
                  setDialogOpen(true);
                }}
              >
                <CardContent className="p-5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => handleDeleteClick(e, course)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="mb-3">
                    <h3 className="font-semibold text-lg mb-2">{course.title}</h3>
                    {course.description && (
                      <p className="text-sm text-slate-600 mb-3">{course.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="outline" className="capitalize">{course.delivery_mode}</Badge>
                    <Badge variant="secondary">{course.duration_days} day(s)</Badge>
                  </div>
                  {course.pricing && course.pricing.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 mb-2">Available Accreditations (prices plus VAT):</p>
                      {course.pricing.map((p: any) => (
                        <div key={p.accreditation} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{p.accreditation}</span>
                          <span className="font-semibold">£{p.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No pricing set</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CourseDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedCourse(null);
          loadCourses();
        }}
        course={selectedCourse}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{courseToDelete?.title}"? This will also delete all associated course runs and bookings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
