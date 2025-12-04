'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Award, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { TrainerDialog } from '@/components/trainer-dialog';
import { format, parseISO, isBefore, addDays } from 'date-fns';
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

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trainerToDelete, setTrainerToDelete] = useState<any>(null);

  useEffect(() => {
    loadTrainers();
  }, []);

  const loadTrainers = async () => {
    try {
      const { data, error } = await supabase
        .from('trainers')
        .select(`
          *,
          trainer_certifications(*)
        `)
        .order('last_name', { ascending: true });

      if (error) throw error;
      setTrainers(data || []);
    } catch (error: any) {
      toast.error('Failed to load trainers');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrainer = () => {
    setSelectedTrainer(null);
    setDialogOpen(true);
  };

  const handleEditTrainer = (trainer: any) => {
    setSelectedTrainer(trainer);
    setDialogOpen(true);
  };

  const handleDeleteTrainer = (trainer: any) => {
    setTrainerToDelete(trainer);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!trainerToDelete) return;

    try {
      const { error } = await supabase
        .from('trainers')
        .delete()
        .eq('id', trainerToDelete.id);

      if (error) throw error;

      toast.success('Trainer deleted successfully');
      loadTrainers();
      setDeleteDialogOpen(false);
      setTrainerToDelete(null);
    } catch (error: any) {
      toast.error('Failed to delete trainer');
      console.error(error);
    }
  };

  const getExpiringCertifications = (certifications: any[]) => {
    if (!certifications || certifications.length === 0) return [];

    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);

    return certifications.filter(cert => {
      if (!cert.expiry_date) return false;
      const expiryDate = parseISO(cert.expiry_date);
      return isBefore(expiryDate, thirtyDaysFromNow) && !isBefore(expiryDate, today);
    });
  };

  const getExpiredCertifications = (certifications: any[]) => {
    if (!certifications || certifications.length === 0) return [];

    const today = new Date();
    return certifications.filter(cert => {
      if (!cert.expiry_date) return false;
      return isBefore(parseISO(cert.expiry_date), today);
    });
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trainers</h1>
            <p className="text-muted-foreground">Manage trainer profiles and certifications</p>
          </div>
          <Button onClick={handleAddTrainer}>
            <Plus className="mr-2 h-4 w-4" />
            Add Trainer
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : trainers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">No trainers found</p>
                <Button onClick={handleAddTrainer}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Trainer
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {trainers.map((trainer) => {
              const expiringCerts = getExpiringCertifications(trainer.trainer_certifications);
              const expiredCerts = getExpiredCertifications(trainer.trainer_certifications);

              return (
                <Card key={trainer.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          {trainer.first_name} {trainer.last_name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={trainer.is_active ? 'default' : 'secondary'}>
                            {trainer.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {expiredCerts.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {expiredCerts.length} Expired
                            </Badge>
                          )}
                          {expiringCerts.length > 0 && (
                            <Badge className="bg-orange-500 text-white text-xs">
                              {expiringCerts.length} Expiring Soon
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTrainer(trainer)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTrainer(trainer)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {trainer.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{trainer.email}</span>
                      </div>
                    )}
                    {trainer.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{trainer.phone}</span>
                      </div>
                    )}
                    {trainer.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{trainer.address}</span>
                      </div>
                    )}

                    {trainer.trainer_certifications && trainer.trainer_certifications.length > 0 && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">
                            Certifications ({trainer.trainer_certifications.length})
                          </span>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {trainer.trainer_certifications.map((cert: any) => {
                            const isExpired = cert.expiry_date && isBefore(parseISO(cert.expiry_date), new Date());
                            const isExpiring = !isExpired && cert.expiry_date &&
                              isBefore(parseISO(cert.expiry_date), addDays(new Date(), 30));

                            return (
                              <div key={cert.id} className="text-xs bg-slate-50 p-2 rounded">
                                <div className="font-medium">{cert.certification_name}</div>
                                {cert.expiry_date && (
                                  <div className={`text-xs mt-1 ${isExpired ? 'text-red-600' : isExpiring ? 'text-orange-600' : 'text-slate-500'}`}>
                                    Expires: {format(parseISO(cert.expiry_date), 'MMM d, yyyy')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <TrainerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        trainer={selectedTrainer}
        onSuccess={() => {
          loadTrainers();
          setDialogOpen(false);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trainer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {trainerToDelete?.first_name} {trainerToDelete?.last_name}?
              This action cannot be undone and will remove all associated certifications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
