'use client';

import { useEffect, useState, useMemo } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowUpDown, Trash2 } from 'lucide-react';
import { getContacts } from '@/lib/db-helpers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type SortOption = 'name-asc' | 'name-desc' | 'email-asc' | 'email-desc' | 'company-asc' | 'company-desc';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [contactToDelete, setContactToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactToDelete.id);

      if (error) throw error;

      toast.success('Contact deleted successfully');
      setContactToDelete(null);
      loadContacts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete contact');
      console.error('Failed to delete contact:', error);
    } finally {
      setDeleting(false);
    }
  };

  const sortedContacts = useMemo(() => {
    const sorted = [...contacts];

    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => {
          const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
          const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
      case 'name-desc':
        return sorted.sort((a, b) => {
          const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
          const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
          return nameB.localeCompare(nameA);
        });
      case 'email-asc':
        return sorted.sort((a, b) => (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase()));
      case 'email-desc':
        return sorted.sort((a, b) => (b.email || '').toLowerCase().localeCompare((a.email || '').toLowerCase()));
      case 'company-asc':
        return sorted.sort((a, b) => {
          const companyA = (a.companies?.name || '').toLowerCase();
          const companyB = (b.companies?.name || '').toLowerCase();
          return companyA.localeCompare(companyB);
        });
      case 'company-desc':
        return sorted.sort((a, b) => {
          const companyA = (a.companies?.name || '').toLowerCase();
          const companyB = (b.companies?.name || '').toLowerCase();
          return companyB.localeCompare(companyA);
        });
      default:
        return sorted;
    }
  }, [contacts, sortBy]);

  const getSortLabel = () => {
    switch (sortBy) {
      case 'name-asc': return 'Name (A-Z)';
      case 'name-desc': return 'Name (Z-A)';
      case 'email-asc': return 'Email (A-Z)';
      case 'email-desc': return 'Email (Z-A)';
      case 'company-asc': return 'Company (A-Z)';
      case 'company-desc': return 'Company (Z-A)';
      default: return 'Sort';
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
            <p className="text-slate-600 mt-1">Manage trainees and contacts</p>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {getSortLabel()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setSortBy('name-asc')}>
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('name-desc')}>
                  Name (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('email-asc')}>
                  Email (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('email-desc')}>
                  Email (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('company-asc')}>
                  Company (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('company-desc')}>
                  Company (Z-A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedContacts.map(contact => (
              <Card key={contact.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {contact.first_name} {contact.last_name}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {contact.email} • {contact.phone}
                        {contact.companies && ` • ${contact.companies.name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{contact.language}</Badge>
                      {contact.gdpr_consent && <Badge>GDPR ✓</Badge>}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setContactToDelete(contact)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contactToDelete?.first_name} {contactToDelete?.last_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
