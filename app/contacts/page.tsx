'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { getContacts } from '@/lib/db-helpers';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filterContacts = (contactsToFilter: any[]) => {
    if (!searchQuery.trim()) return contactsToFilter;

    const query = searchQuery.toLowerCase();
    return contactsToFilter.filter(contact =>
      contact.first_name?.toLowerCase().includes(query) ||
      contact.last_name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query) ||
      contact.companies?.name?.toLowerCase().includes(query) ||
      contact.job_title?.toLowerCase().includes(query)
    );
  };

  const filteredContacts = filterContacts(contacts);

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
              <p className="text-slate-600 mt-1">Manage trainees and contacts</p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search contacts by name, email, phone, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {searchQuery ? 'No contacts found matching your search' : 'No contacts yet'}
              </div>
            ) : (
              filteredContacts.map(contact => (
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
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
