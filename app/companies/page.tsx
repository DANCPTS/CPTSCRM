'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, User, Trash2 } from 'lucide-react';
import { getCompanies } from '@/lib/db-helpers';
import { CompanyDialog } from '@/components/company-dialog';
import { supabase } from '@/lib/supabase';
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

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (search) {
      setFilteredCompanies(
        companies.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.city?.toLowerCase().includes(search.toLowerCase())
        )
      );
    } else {
      setFilteredCompanies(companies);
    }
  }, [search, companies]);

  const loadCompanies = async () => {
    try {
      const data = await getCompanies();
      setCompanies(data);
      setFilteredCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (company: any) => {
    setSelectedCompany(company);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedCompany(null);
    loadCompanies();
  };

  const handleDeleteClick = (company: any) => {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyToDelete.id);

      if (error) throw error;

      toast.success('Company deleted successfully');
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
      loadCompanies();
    } catch (error: any) {
      toast.error('Failed to delete company: ' + error.message);
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
            <h1 className="text-3xl font-bold text-slate-900">Companies</h1>
            <p className="text-slate-600 mt-1">Manage client companies</p>
          </div>
          <Button onClick={() => {
            setSelectedCompany(null);
            setDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map(company => (
              <Card
                key={company.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleEdit(company)}
              >
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2">{company.name}</h3>
                  <div className="text-sm text-slate-600 space-y-1">
                    {company.city && <p>{company.city}, {company.postcode}</p>}
                    {company.registration_no && <p>Reg: {company.registration_no}</p>}
                    {company.vat_no && <p>VAT: {company.vat_no}</p>}
                    {company.users && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                        <User className="h-3 w-3" />
                        <span>Manager: {company.users.full_name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CompanyDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        company={selectedCompany}
        onDelete={handleDeleteClick}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {companyToDelete?.name}? This action cannot be undone.
              All associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Company'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
