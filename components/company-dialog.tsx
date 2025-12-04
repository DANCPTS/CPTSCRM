'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Trash2, Mail, Phone, Building2, Users } from 'lucide-react';

interface CompanyDialogProps {
  open: boolean;
  onClose: () => void;
  company?: any;
  onDelete?: (company: any) => void;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  language: string;
  notes?: string;
}

export function CompanyDialog({ open, onClose, company, onDelete }: CompanyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    registration_no: '',
    address: '',
    city: '',
    postcode: '',
    vat_no: '',
    notes: '',
    account_manager_id: '',
  });
  const [contactFormData, setContactFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    language: 'EN',
    notes: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        registration_no: company.registration_no || '',
        address: company.address || '',
        city: company.city || '',
        postcode: company.postcode || '',
        vat_no: company.vat_no || '',
        notes: company.notes || '',
        account_manager_id: company.account_manager_id || '',
      });
      loadContacts(company.id);
    } else {
      setFormData({
        name: '',
        registration_no: '',
        address: '',
        city: '',
        postcode: '',
        vat_no: '',
        notes: '',
        account_manager_id: '',
      });
      setContacts([]);
    }
    setShowContactForm(false);
    setEditingContact(null);
  }, [company, open]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
    }
  };

  const loadContacts = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('last_name', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error('Failed to load contacts:', error);
    }
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setContactFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      language: 'EN',
      notes: '',
    });
    setShowContactForm(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || '',
      phone: contact.phone || '',
      language: contact.language,
      notes: contact.notes || '',
    });
    setShowContactForm(true);
  };

  const handleSaveContact = async () => {
    if (!company) {
      toast.error('Please save the company first');
      return;
    }

    if (!contactFormData.first_name || !contactFormData.last_name) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      const contactData = {
        first_name: contactFormData.first_name,
        last_name: contactFormData.last_name,
        email: contactFormData.email || null,
        phone: contactFormData.phone || null,
        language: contactFormData.language,
        notes: contactFormData.notes || null,
        company_id: company.id,
      };

      if (editingContact) {
        const { error } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', editingContact.id);

        if (error) throw error;
        toast.success('Contact updated');
      } else {
        const { error } = await supabase
          .from('contacts')
          .insert([contactData]);

        if (error) throw error;
        toast.success('Contact added');
      }

      setShowContactForm(false);
      setEditingContact(null);
      loadContacts(company.id);
    } catch (error: any) {
      toast.error('Failed to save contact');
      console.error(error);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      toast.success('Contact deleted');
      if (company) {
        loadContacts(company.id);
      }
    } catch (error: any) {
      toast.error('Failed to delete contact');
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (company) {
        const { error } = await supabase
          .from('companies')
          .update(formData)
          .eq('id', company.id);

        if (error) throw error;
        toast.success('Company updated successfully');
      } else {
        const { error } = await supabase
          .from('companies')
          .insert([formData]);

        if (error) throw error;
        toast.success('Company created successfully');
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save company');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? company.name : 'Add New Company'}</DialogTitle>
          <DialogDescription>
            {company ? 'Manage company information and contacts' : 'Add a new client company'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">
              <Building2 className="h-4 w-4 mr-2" />
              Company Details
            </TabsTrigger>
            <TabsTrigger value="contacts" disabled={!company}>
              <Users className="h-4 w-4 mr-2" />
              Contacts ({contacts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_no">Registration No</Label>
              <Input
                id="registration_no"
                value={formData.registration_no}
                onChange={(e) => setFormData({ ...formData, registration_no: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat_no">VAT No</Label>
              <Input
                id="vat_no"
                value={formData.vat_no}
                onChange={(e) => setFormData({ ...formData, vat_no: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_manager_id">Account Manager</Label>
            <Select
              value={formData.account_manager_id || 'none'}
              onValueChange={(value) => setFormData({ ...formData, account_manager_id: value === 'none' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account manager..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

              <DialogFooter className="flex justify-between items-center">
                <div>
                  {company && onDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onDelete(company)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Company
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : company ? 'Update Company' : 'Create Company'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Company Contacts</h3>
                <Button size="sm" onClick={handleAddContact}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </div>

              {showContactForm && (
                <Card className="border-2 border-slate-300">
                  <CardContent className="pt-6 space-y-4">
                    <h4 className="font-semibold">{editingContact ? 'Edit Contact' : 'New Contact'}</h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contact_first_name">First Name *</Label>
                        <Input
                          id="contact_first_name"
                          value={contactFormData.first_name}
                          onChange={(e) => setContactFormData({ ...contactFormData, first_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact_last_name">Last Name *</Label>
                        <Input
                          id="contact_last_name"
                          value={contactFormData.last_name}
                          onChange={(e) => setContactFormData({ ...contactFormData, last_name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contact_email">Email</Label>
                        <Input
                          id="contact_email"
                          type="email"
                          value={contactFormData.email}
                          onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact_phone">Phone</Label>
                        <Input
                          id="contact_phone"
                          value={contactFormData.phone}
                          onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="contact_language">Language</Label>
                      <Select value={contactFormData.language} onValueChange={(value) => setContactFormData({ ...contactFormData, language: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EN">English</SelectItem>
                          <SelectItem value="PL">Polish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="contact_notes">Notes</Label>
                      <Textarea
                        id="contact_notes"
                        value={contactFormData.notes}
                        onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" onClick={handleSaveContact}>
                        {editingContact ? 'Update' : 'Add'} Contact
                      </Button>
                      <Button type="button" variant="outline" onClick={() => {
                        setShowContactForm(false);
                        setEditingContact(null);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {contacts.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  <Users className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p>No contacts added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map(contact => (
                    <Card key={contact.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold">
                              {contact.first_name} {contact.last_name}
                            </h4>
                            <div className="mt-2 space-y-1 text-sm text-slate-600">
                              {contact.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3" />
                                  <span>{contact.email}</span>
                                </div>
                              )}
                              {contact.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  <span>{contact.phone}</span>
                                </div>
                              )}
                              <div className="text-xs">
                                Language: {contact.language === 'EN' ? 'English' : 'Polish'}
                              </div>
                            </div>
                            {contact.notes && (
                              <p className="mt-2 text-sm text-slate-600">{contact.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditContact(contact)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteContact(contact.id)}
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
  );
}
