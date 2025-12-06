'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, User, FileText, GraduationCap, Upload, Trash2, Download, XCircle, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AttendanceDialog } from '@/components/attendance-dialog';

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  postcode?: string;
  national_insurance_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  status: string;
  created_at: string;
}

interface CandidateFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  storage_path: string;
  description?: string;
  uploaded_at: string;
}

interface CandidateCourse {
  id: string;
  course_id: string;
  enrollment_date: string;
  completion_date?: string;
  status: string;
  result?: string;
  grade?: string;
  certificate_number?: string;
  notes?: string;
  courses?: {
    title: string;
  };
  course_runs?: {
    start_date: string;
    end_date: string;
    location: string;
  };
}

export default function CandidatesPage() {
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateFiles, setCandidateFiles] = useState<CandidateFile[]>([]);
  const [candidateCourses, setCandidateCourses] = useState<CandidateCourse[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<CandidateCourse[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedCandidateCourse, setSelectedCandidateCourse] = useState<any>(null);
  const [selectedCourseRun, setSelectedCourseRun] = useState<any>(null);
  const [adhocEnrollmentOpen, setAdhocEnrollmentOpen] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [adhocFormData, setAdhocFormData] = useState({
    course_id: '',
    enrollment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    address: '',
    city: '',
    postcode: '',
    national_insurance_number: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
    status: 'active',
  });

  useEffect(() => {
    loadCandidates();
    loadCourses();
  }, []);

  useEffect(() => {
    filterCandidates();
  }, [searchQuery, candidates]);

  useEffect(() => {
    const candidateId = searchParams.get('id');
    if (candidateId && candidates.length > 0) {
      const candidate = candidates.find(c => c.id === candidateId);
      if (candidate) {
        handleViewCandidate(candidate);
      }
    }
  }, [searchParams, candidates]);

  const loadCandidates = async () => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('last_name', { ascending: true });

      if (error) throw error;
      setCandidates(data || []);
    } catch (error: any) {
      toast.error('Failed to load candidates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterCandidates = () => {
    if (!searchQuery.trim()) {
      setFilteredCandidates(candidates);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = candidates.filter(candidate => {
      const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
      return (
        fullName.includes(query) ||
        candidate.email?.toLowerCase().includes(query) ||
        candidate.phone?.includes(query) ||
        candidate.postcode?.toLowerCase().includes(query)
      );
    });
    setFilteredCandidates(filtered);
  };

  const handleCreateCandidate = () => {
    setSelectedCandidate(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      address: '',
      city: '',
      postcode: '',
      national_insurance_number: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      notes: '',
      status: 'active',
    });
    setDialogOpen(true);
  };

  const handleViewCandidate = async (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setFormData({
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      email: candidate.email || '',
      phone: candidate.phone || '',
      date_of_birth: candidate.date_of_birth || '',
      address: candidate.address || '',
      city: candidate.city || '',
      postcode: candidate.postcode || '',
      national_insurance_number: candidate.national_insurance_number || '',
      emergency_contact_name: candidate.emergency_contact_name || '',
      emergency_contact_phone: candidate.emergency_contact_phone || '',
      notes: candidate.notes || '',
      status: candidate.status,
    });
    await loadCandidateFiles(candidate.id);
    await loadCandidateCourses(candidate.id);
    setDialogOpen(true);
  };

  const loadCandidateFiles = async (candidateId: string) => {
    try {
      const { data, error } = await supabase
        .from('candidate_files')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setCandidateFiles(data || []);
    } catch (error: any) {
      console.error('Failed to load files:', error);
    }
  };

  const loadCandidateCourses = async (candidateId: string) => {
    try {
      const { data, error } = await supabase
        .from('candidate_courses')
        .select('*, courses!course_id(title), course_runs!course_run_id(start_date, end_date, location, training_days, test_days)')
        .eq('candidate_id', candidateId)
        .order('enrollment_date', { ascending: false });

      if (error) throw error;

      // Separate active enrollments from completed training history
      const active = data?.filter(c => c.status === 'enrolled') || [];
      const history = data?.filter(c => c.status === 'completed' || c.status === 'cancelled') || [];

      setCandidateCourses(active);
      setTrainingHistory(history);
    } catch (error: any) {
      console.error('Failed to load courses:', error);
    }
  };

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, code')
        .order('title');

      if (error) throw error;
      setAvailableCourses(data || []);
    } catch (error: any) {
      console.error('Failed to load courses:', error);
    }
  };

  const handleCancelCourse = async (courseId: string) => {
    if (!window.confirm('Are you sure you want to cancel this course enrollment? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('candidate_courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      toast.success('Course enrollment cancelled');
      if (selectedCandidate) {
        loadCandidateCourses(selectedCandidate.id);
      }
    } catch (error: any) {
      console.error('Failed to cancel course:', error);
      toast.error('Failed to cancel course enrollment');
    }
  };

  const handleAdhocEnrollment = async () => {
    if (!selectedCandidate || !adhocFormData.course_id) {
      toast.error('Please select a course');
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        toast.error('You must be logged in');
        return;
      }

      const { error } = await supabase
        .from('candidate_courses')
        .insert({
          candidate_id: selectedCandidate.id,
          course_id: adhocFormData.course_id,
          enrollment_date: adhocFormData.enrollment_date,
          status: 'enrolled',
          notes: adhocFormData.notes,
          created_by: authData.user.id,
        });

      if (error) throw error;

      toast.success('Candidate enrolled in ad-hoc course');
      setAdhocEnrollmentOpen(false);
      setAdhocFormData({
        course_id: '',
        enrollment_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      loadCandidateCourses(selectedCandidate.id);
    } catch (error: any) {
      console.error('Failed to enroll candidate:', error);
      toast.error('Failed to enroll candidate');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCandidate || !event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedCandidate.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('candidate-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('candidate-files')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('candidate_files')
        .insert({
          candidate_id: selectedCandidate.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: urlData.publicUrl,
          storage_path: fileName,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      toast.success('File uploaded successfully');
      loadCandidateFiles(selectedCandidate.id);
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload file: ' + error.message);
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleFileDelete = async (fileId: string, storagePath: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage
        .from('candidate-files')
        .remove([storagePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('candidate_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      toast.success('File deleted successfully');
      if (selectedCandidate) {
        loadCandidateFiles(selectedCandidate.id);
      }
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete file: ' + error.message);
    }
  };

  const handleFileDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error('Failed to download file');
    }
  };

  const handleSaveCandidate = async () => {
    if (!formData.first_name || !formData.last_name) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const candidateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        date_of_birth: formData.date_of_birth || null,
        address: formData.address || null,
        city: formData.city || null,
        postcode: formData.postcode || null,
        national_insurance_number: formData.national_insurance_number || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        notes: formData.notes || null,
        status: formData.status,
      };

      if (selectedCandidate) {
        const { error } = await supabase
          .from('candidates')
          .update(candidateData)
          .eq('id', selectedCandidate.id);

        if (error) throw error;
        toast.success('Candidate updated');
      } else {
        const { error } = await supabase
          .from('candidates')
          .insert([{ ...candidateData, created_by: user.id }]);

        if (error) throw error;
        toast.success('Candidate created');
      }

      setDialogOpen(false);
      loadCandidates();
    } catch (error: any) {
      toast.error('Failed to save candidate');
      console.error(error);
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm('Are you sure you want to delete this candidate? This will also delete all associated files and course records.')) return;

    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', candidateId);

      if (error) throw error;
      toast.success('Candidate deleted');
      setDialogOpen(false);
      loadCandidates();
    } catch (error: any) {
      toast.error('Failed to delete candidate');
      console.error(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Candidates</h1>
            <p className="text-slate-600 mt-1">Manage candidate profiles and training records</p>
          </div>
          <Button onClick={handleCreateCandidate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Candidate
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search candidates by name, email, phone, or postcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCandidates.map(candidate => (
              <Card key={candidate.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleViewCandidate(candidate)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="h-6 w-6 text-slate-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {candidate.first_name} {candidate.last_name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {candidate.email || 'No email'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(candidate.status)}>
                      {candidate.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-slate-600">
                    {candidate.phone && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Phone:</span>
                        <span>{candidate.phone}</span>
                      </div>
                    )}
                    {candidate.city && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Location:</span>
                        <span>{candidate.city}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && filteredCandidates.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">No candidates found</p>
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCandidate ? `${selectedCandidate.first_name} ${selectedCandidate.last_name}` : 'New Candidate'}
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">
                  <User className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="courses" disabled={!selectedCandidate}>
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Courses
                </TabsTrigger>
                <TabsTrigger value="history" disabled={!selectedCandidate}>
                  <Calendar className="h-4 w-4 mr-2" />
                  History
                </TabsTrigger>
                <TabsTrigger value="files" disabled={!selectedCandidate}>
                  <FileText className="h-4 w-4 mr-2" />
                  Files
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="national_insurance_number">National Insurance Number</Label>
                    <Input
                      id="national_insurance_number"
                      value={formData.national_insurance_number}
                      onChange={(e) => setFormData({ ...formData, national_insurance_number: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                    <Input
                      id="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                    <Input
                      id="emergency_contact_phone"
                      value={formData.emergency_contact_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveCandidate} className="flex-1">
                    {selectedCandidate ? 'Update' : 'Create'} Candidate
                  </Button>
                  {selectedCandidate && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteCandidate(selectedCandidate.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="courses" className="mt-4">
                <div className="flex justify-end mb-4">
                  <Button
                    onClick={() => setAdhocEnrollmentOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ad-hoc Enrollment
                  </Button>
                </div>

                {candidateCourses.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    <GraduationCap className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <p>No courses enrolled yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidateCourses.map(course => (
                      <Card key={course.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-semibold">{course.courses?.title || 'Unknown Course'}</h4>
                              <div className="flex flex-col gap-1 mt-2 text-sm text-slate-600">
                                {course.course_runs ? (
                                  <>
                                    <span>Course Dates: {format(new Date(course.course_runs.start_date), 'dd/MM/yyyy')} - {format(new Date(course.course_runs.end_date), 'dd/MM/yyyy')}</span>
                                    {course.course_runs.location && (
                                      <span>Location: {course.course_runs.location}</span>
                                    )}
                                  </>
                                ) : (
                                  <Badge variant="outline" className="w-fit">Ad-hoc Enrollment</Badge>
                                )}
                                <span>Enrolled: {format(new Date(course.enrollment_date), 'dd/MM/yyyy')}</span>
                                {course.completion_date && (
                                  <span>Completed: {format(new Date(course.completion_date), 'dd/MM/yyyy')}</span>
                                )}
                              </div>
                              {course.certificate_number && (
                                <p className="text-sm text-slate-600 mt-1">Cert: {course.certificate_number}</p>
                              )}
                            </div>
                            <div className="flex gap-2 items-start">
                              <div className="flex flex-col gap-2 items-end">
                                <Badge>{course.status}</Badge>
                                <select
                                  value={course.result || 'pending'}
                                  onChange={async (e) => {
                                    const newResult = e.target.value;
                                    try {
                                      const { error } = await supabase
                                        .from('candidate_courses')
                                        .update({ result: newResult })
                                        .eq('id', course.id);

                                      if (error) throw error;

                                      toast.success('Result updated');
                                      if (selectedCandidate) {
                                        loadCandidateCourses(selectedCandidate.id);
                                      }
                                    } catch (error: any) {
                                      toast.error('Failed to update result');
                                    }
                                  }}
                                  className="text-sm border rounded-md px-2 py-1"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="passed">Passed</option>
                                  <option value="failed">Failed</option>
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCandidateCourse(course);
                                    setSelectedCourseRun(course.course_runs);
                                    setAttendanceDialogOpen(true);
                                  }}
                                  title="Mark attendance"
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelCourse(course.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Cancel enrollment"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {trainingHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <p>No training history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-600 mb-4">
                      Completed and cancelled training sessions
                    </div>
                    {trainingHistory.map(course => (
                      <Card key={course.id} className={course.status === 'cancelled' ? 'opacity-60' : ''}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{course.courses?.title || 'Unknown Course'}</h4>
                                <Badge variant={course.status === 'completed' ? 'default' : 'secondary'}>
                                  {course.status}
                                </Badge>
                              </div>
                              <div className="flex flex-col gap-1 mt-2 text-sm text-slate-600">
                                {course.course_runs ? (
                                  <>
                                    <span>Course Dates: {format(new Date(course.course_runs.start_date), 'dd/MM/yyyy')} - {format(new Date(course.course_runs.end_date), 'dd/MM/yyyy')}</span>
                                    {course.course_runs.location && (
                                      <span>Location: {course.course_runs.location}</span>
                                    )}
                                  </>
                                ) : (
                                  <Badge variant="outline" className="w-fit">Ad-hoc Enrollment</Badge>
                                )}
                                <span>Enrolled: {format(new Date(course.enrollment_date), 'dd/MM/yyyy')}</span>
                                {course.completion_date && (
                                  <span>Completed: {format(new Date(course.completion_date), 'dd/MM/yyyy')}</span>
                                )}
                              </div>
                              {course.certificate_number && (
                                <div className="mt-2 text-sm">
                                  <span className="font-medium">Certificate:</span> {course.certificate_number}
                                </div>
                              )}
                              {course.notes && (
                                <div className="mt-2 text-sm text-slate-600 italic">
                                  {course.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              {course.result && (
                                <Badge
                                  className={
                                    course.result === 'passed'
                                      ? 'bg-green-100 text-green-800'
                                      : course.result === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-slate-100 text-slate-800'
                                  }
                                >
                                  {course.result === 'passed' ? '✓ Passed' : course.result === 'failed' ? '✗ Failed' : 'Pending'}
                                </Badge>
                              )}
                              {course.grade && (
                                <div className="text-sm font-medium">
                                  Grade: {course.grade}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="files" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload File'}
                    </Button>
                  </div>

                  {candidateFiles.length === 0 ? (
                    <div className="text-center py-12 text-slate-600">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                      <p>No files uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {candidateFiles.map(file => (
                        <Card key={file.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-slate-400" />
                                <div>
                                  <p className="font-medium">{file.file_name}</p>
                                  <p className="text-sm text-slate-600">
                                    {(file.file_size / 1024).toFixed(2)} KB • {format(new Date(file.uploaded_at), 'dd/MM/yyyy')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleFileDownload(file.file_url, file.file_name)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleFileDelete(file.id, file.storage_path)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <AttendanceDialog
          open={attendanceDialogOpen}
          onOpenChange={setAttendanceDialogOpen}
          candidateCourse={selectedCandidateCourse}
          courseRun={selectedCourseRun}
        />

        <Dialog open={adhocEnrollmentOpen} onOpenChange={setAdhocEnrollmentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ad-hoc Course Enrollment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-slate-600">
                Enroll {selectedCandidate?.first_name} {selectedCandidate?.last_name} in a course without linking to a scheduled course run. Perfect for tests, private sessions, or one-off bookings.
              </p>

              <div className="space-y-2">
                <Label htmlFor="adhoc-course">Course *</Label>
                <Select
                  value={adhocFormData.course_id}
                  onValueChange={(value) => setAdhocFormData({ ...adhocFormData, course_id: value })}
                >
                  <SelectTrigger id="adhoc-course">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCourses.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrollment-date">Enrollment Date *</Label>
                <Input
                  id="enrollment-date"
                  type="date"
                  value={adhocFormData.enrollment_date}
                  onChange={(e) => setAdhocFormData({ ...adhocFormData, enrollment_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adhoc-notes">Notes</Label>
                <Textarea
                  id="adhoc-notes"
                  placeholder="e.g., Test only, Private booking for XYZ, etc."
                  value={adhocFormData.notes}
                  onChange={(e) => setAdhocFormData({ ...adhocFormData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAdhocEnrollment} className="flex-1">
                  Enroll Candidate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAdhocEnrollmentOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
