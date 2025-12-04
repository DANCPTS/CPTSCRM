'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Trash2, User, Award, Upload, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface TrainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainer: any;
  onSuccess: () => void;
}

export function TrainerDialog({ open, onOpenChange, trainer, onSuccess }: TrainerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
    is_active: true,
  });
  const [certifications, setCertifications] = useState<any[]>([]);
  const [newCert, setNewCert] = useState({
    certification_name: '',
    certification_number: '',
    issuing_organization: '',
    issue_date: '',
    expiry_date: '',
    notes: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (trainer) {
      setFormData({
        first_name: trainer.first_name || '',
        last_name: trainer.last_name || '',
        email: trainer.email || '',
        phone: trainer.phone || '',
        address: trainer.address || '',
        date_of_birth: trainer.date_of_birth || '',
        emergency_contact_name: trainer.emergency_contact_name || '',
        emergency_contact_phone: trainer.emergency_contact_phone || '',
        notes: trainer.notes || '',
        is_active: trainer.is_active !== false,
      });
      setCertifications(trainer.trainer_certifications || []);
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        date_of_birth: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        notes: '',
        is_active: true,
      });
      setCertifications([]);
    }
    setNewCert({
      certification_name: '',
      certification_number: '',
      issuing_organization: '',
      issue_date: '',
      expiry_date: '',
      notes: '',
    });
    setSelectedFile(null);
  }, [trainer, open]);

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (trainer) {
        const { error } = await supabase
          .from('trainers')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            date_of_birth: formData.date_of_birth || null,
            emergency_contact_name: formData.emergency_contact_name || null,
            emergency_contact_phone: formData.emergency_contact_phone || null,
            notes: formData.notes || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', trainer.id);

        if (error) throw error;
        toast.success('Trainer updated successfully');
      } else {
        const { error } = await supabase
          .from('trainers')
          .insert([{
            ...formData,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            date_of_birth: formData.date_of_birth || null,
            emergency_contact_name: formData.emergency_contact_name || null,
            emergency_contact_phone: formData.emergency_contact_phone || null,
            notes: formData.notes || null,
            created_by: user.id,
          }]);

        if (error) throw error;
        toast.success('Trainer created successfully');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(trainer ? 'Failed to update trainer' : 'Failed to create trainer');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCertification = async () => {
    if (!newCert.certification_name) {
      toast.error('Please enter certification name');
      return;
    }

    if (!trainer) {
      toast.error('Please save the trainer profile first');
      return;
    }

    setUploadingFile(true);
    try {
      let fileUrl = null;
      let fileName = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const tempCertId = crypto.randomUUID();
        const filePath = `${trainer.id}/${tempCertId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('trainer-certifications')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        fileUrl = filePath;
        fileName = selectedFile.name;
      }

      const { error } = await supabase
        .from('trainer_certifications')
        .insert([{
          trainer_id: trainer.id,
          ...newCert,
          issue_date: newCert.issue_date || null,
          expiry_date: newCert.expiry_date || null,
          notes: newCert.notes || null,
          file_url: fileUrl,
          file_name: fileName,
        }]);

      if (error) throw error;

      toast.success('Certification added');
      setNewCert({
        certification_name: '',
        certification_number: '',
        issuing_organization: '',
        issue_date: '',
        expiry_date: '',
        notes: '',
      });
      setSelectedFile(null);

      const { data } = await supabase
        .from('trainer_certifications')
        .select('*')
        .eq('trainer_id', trainer.id);

      setCertifications(data || []);
    } catch (error: any) {
      toast.error('Failed to add certification');
      console.error(error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteCertification = async (certId: string) => {
    try {
      const cert = certifications.find(c => c.id === certId);

      if (cert?.file_url) {
        const { error: deleteFileError } = await supabase.storage
          .from('trainer-certifications')
          .remove([cert.file_url]);

        if (deleteFileError) console.error('Failed to delete file:', deleteFileError);
      }

      const { error } = await supabase
        .from('trainer_certifications')
        .delete()
        .eq('id', certId);

      if (error) throw error;

      toast.success('Certification deleted');
      setCertifications(certifications.filter(c => c.id !== certId));
    } catch (error: any) {
      toast.error('Failed to delete certification');
      console.error(error);
    }
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('trainer-certifications')
        .download(fileUrl);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('File downloaded');
    } catch (error: any) {
      toast.error('Failed to download file');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trainer ? 'Edit Trainer' : 'Add New Trainer'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="certifications" disabled={!trainer}>
              <Award className="h-4 w-4 mr-2" />
              Certifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
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
                  placeholder="john.smith@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="07123 456789"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main Street, City, Postcode"
              />
            </div>

            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                <Input
                  id="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                <Input
                  id="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  placeholder="07123 456789"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about the trainer"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active Trainer</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : trainer ? 'Update Trainer' : 'Create Trainer'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="certifications" className="space-y-4 mt-4">
            {certifications.length > 0 && (
              <div className="space-y-2 mb-4">
                {certifications.map((cert) => (
                  <Card key={cert.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{cert.certification_name}</h4>
                          {cert.certification_number && (
                            <p className="text-sm text-muted-foreground">Number: {cert.certification_number}</p>
                          )}
                          {cert.issuing_organization && (
                            <p className="text-sm text-muted-foreground">Issued by: {cert.issuing_organization}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            {cert.issue_date && <span>Issued: {format(new Date(cert.issue_date), 'MMM d, yyyy')}</span>}
                            {cert.expiry_date && <span>Expires: {format(new Date(cert.expiry_date), 'MMM d, yyyy')}</span>}
                          </div>
                          {cert.notes && (
                            <p className="text-sm text-muted-foreground mt-2">{cert.notes}</p>
                          )}
                          {cert.file_name && (
                            <div className="flex items-center gap-2 mt-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-blue-600"
                                onClick={() => handleDownloadFile(cert.file_url, cert.file_name)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                {cert.file_name}
                              </Button>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCertification(cert.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardContent className="p-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Certification
                </h4>

                <div>
                  <Label htmlFor="cert_name">Certification Name *</Label>
                  <Input
                    id="cert_name"
                    value={newCert.certification_name}
                    onChange={(e) => setNewCert({ ...newCert, certification_name: e.target.value })}
                    placeholder="e.g., CPCS Instructor, NPORS Tester"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cert_number">Certification Number</Label>
                    <Input
                      id="cert_number"
                      value={newCert.certification_number}
                      onChange={(e) => setNewCert({ ...newCert, certification_number: e.target.value })}
                      placeholder="Certificate ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cert_org">Issuing Organization</Label>
                    <Input
                      id="cert_org"
                      value={newCert.issuing_organization}
                      onChange={(e) => setNewCert({ ...newCert, issuing_organization: e.target.value })}
                      placeholder="e.g., CPCS, NPORS"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cert_issue_date">Issue Date</Label>
                    <Input
                      id="cert_issue_date"
                      type="date"
                      value={newCert.issue_date}
                      onChange={(e) => setNewCert({ ...newCert, issue_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cert_expiry_date">Expiry Date</Label>
                    <Input
                      id="cert_expiry_date"
                      type="date"
                      value={newCert.expiry_date}
                      onChange={(e) => setNewCert({ ...newCert, expiry_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="cert_notes">Notes</Label>
                  <Textarea
                    id="cert_notes"
                    value={newCert.notes}
                    onChange={(e) => setNewCert({ ...newCert, notes: e.target.value })}
                    placeholder="Additional details"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="cert_file">Upload Certification Document (Optional)</Label>
                  <div className="mt-2">
                    <Input
                      id="cert_file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="cursor-pointer"
                    />
                    {selectedFile && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{selectedFile.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                          className="h-6 px-2"
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={handleAddCertification} className="w-full" disabled={uploadingFile}>
                  {uploadingFile ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Certification
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
