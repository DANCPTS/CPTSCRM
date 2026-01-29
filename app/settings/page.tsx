'use client';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Plus, Trash2, Key, Users as UsersIcon, UserCog, Palette, Moon, Sun, Waves, Trees, Mail, Server, Eye, EyeOff, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

const DEFAULT_CATEGORIES = [
  { name: 'Training', value: 'training' },
  { name: 'Theory Test', value: 'theory_test' },
  { name: 'Practical Test', value: 'practical_test' },
  { name: 'Assessment', value: 'assessment' },
  { name: 'Other', value: 'other' },
];

const AVAILABLE_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
];

export default function SettingsPage() {
  const { userProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [importing, setImporting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'sales' as 'admin' | 'sales' | 'trainer',
  });
  const [processing, setProcessing] = useState(false);
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({});
  const [loadingColors, setLoadingColors] = useState(true);
  const [transactionalSettings, setTransactionalSettings] = useState({
    smtp_host: '',
    smtp_port: 465,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
  });
  const [marketingSettings, setMarketingSettings] = useState({
    smtp_host: '',
    smtp_port: 465,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
  });
  const [loadingEmailSettings, setLoadingEmailSettings] = useState(true);
  const [savingTransactional, setSavingTransactional] = useState(false);
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [showTransactionalPassword, setShowTransactionalPassword] = useState(false);
  const [showMarketingPassword, setShowMarketingPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExportLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .csv();

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Leads exported successfully');
    } catch (error: any) {
      toast.error('Failed to export leads');
      console.error(error);
    }
  };

  const handleExportContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .csv();

      if (error) throw error;

      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Contacts exported successfully');
    } catch (error: any) {
      toast.error('Failed to export contacts');
      console.error(error);
    }
  };

  const handleExportBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, contacts(first_name, last_name, email), companies(name), course_runs(start_date, courses(title))')

      if (error) throw error;

      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Bookings exported successfully');
    } catch (error: any) {
      toast.error('Failed to export bookings');
      console.error(error);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (!data.length) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  };

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      loadUsers();
      loadEmailSettings();
    }
    loadCalendarColors();
  }, [userProfile]);

  const loadEmailSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*');

      if (error) throw error;

      if (data) {
        const transactional = data.find(s => s.settings_type === 'transactional');
        const marketing = data.find(s => s.settings_type === 'marketing');

        if (transactional) {
          setTransactionalSettings({
            smtp_host: transactional.smtp_host || '',
            smtp_port: transactional.smtp_port || 465,
            smtp_username: transactional.smtp_username || '',
            smtp_password: transactional.smtp_password || '',
            from_email: transactional.from_email || '',
            from_name: transactional.from_name || '',
          });
        }

        if (marketing) {
          setMarketingSettings({
            smtp_host: marketing.smtp_host || '',
            smtp_port: marketing.smtp_port || 465,
            smtp_username: marketing.smtp_username || '',
            smtp_password: marketing.smtp_password || '',
            from_email: marketing.from_email || '',
            from_name: marketing.from_name || '',
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to load email settings:', error);
    } finally {
      setLoadingEmailSettings(false);
    }
  };

  const handleSaveTransactionalSettings = async () => {
    setSavingTransactional(true);
    try {
      const { error } = await supabase
        .from('email_settings')
        .upsert({
          settings_type: 'transactional',
          smtp_host: transactionalSettings.smtp_host,
          smtp_port: transactionalSettings.smtp_port,
          smtp_username: transactionalSettings.smtp_username,
          smtp_password: transactionalSettings.smtp_password,
          from_email: transactionalSettings.from_email,
          from_name: transactionalSettings.from_name,
        }, { onConflict: 'settings_type' });

      if (error) throw error;
      toast.success('Transactional email settings saved');
    } catch (error: any) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSavingTransactional(false);
    }
  };

  const handleSaveMarketingSettings = async () => {
    setSavingMarketing(true);
    try {
      const { error } = await supabase
        .from('email_settings')
        .upsert({
          settings_type: 'marketing',
          smtp_host: marketingSettings.smtp_host,
          smtp_port: marketingSettings.smtp_port,
          smtp_username: marketingSettings.smtp_username,
          smtp_password: marketingSettings.smtp_password,
          from_email: marketingSettings.from_email,
          from_name: marketingSettings.from_name,
        }, { onConflict: 'settings_type' });

      if (error) throw error;
      toast.success('Marketing email settings saved');
    } catch (error: any) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSavingMarketing(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadCalendarColors = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_settings')
        .select('*');

      if (error) throw error;

      const colorMap: Record<string, string> = {};
      if (data) {
        data.forEach((setting: any) => {
          colorMap[setting.category] = setting.color;
        });
      }
      setCalendarColors(colorMap);
    } catch (error: any) {
      console.error('Failed to load calendar colors:', error);
    } finally {
      setLoadingColors(false);
    }
  };

  const handleColorChange = async (category: string, color: string) => {
    try {
      const { error } = await supabase
        .from('calendar_settings')
        .upsert({
          user_id: userProfile?.id,
          category,
          color,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,category',
        });

      if (error) throw error;

      setCalendarColors({ ...calendarColors, [category]: color });
      toast.success('Calendar color updated');
    } catch (error: any) {
      toast.error('Failed to update calendar color');
      console.error(error);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-management`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      toast.success('User created successfully');
      setCreateDialogOpen(false);
      setFormData({ email: '', password: '', confirmPassword: '', fullName: '', role: 'sales' });
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!formData.password || !selectedUser) {
      toast.error('Please enter a new password');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-management`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updatePassword',
          userId: selectedUser.id,
          password: formData.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update password');
      }

      toast.success('Password updated successfully');
      setPasswordDialogOpen(false);
      setFormData({ email: '', password: '', confirmPassword: '', fullName: '', role: 'sales' });
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!formData.role || !selectedUser) {
      toast.error('Please select a role');
      return;
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-management`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateRole',
          userId: selectedUser.id,
          role: formData.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update role');
      }

      toast.success('Role updated successfully');
      setRoleDialogOpen(false);
      setFormData({ email: '', password: '', confirmPassword: '', fullName: '', role: 'sales' });
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-management`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          userId: selectedUser.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleImportLeads = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());

      const leads = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const lead: any = {};

        headers.forEach((header, i) => {
          const value = values[i]?.trim();
          if (header === 'training_interest' && value) {
            lead[header] = value.split(';').map((v: string) => v.trim());
          } else {
            lead[header] = value || null;
          }
        });

        return lead;
      });

      const { error } = await supabase
        .from('leads')
        .insert(leads);

      if (error) throw error;

      toast.success(`Imported ${leads.length} leads successfully`);
      e.target.value = '';
    } catch (error: any) {
      toast.error('Failed to import leads: ' + error.message);
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage system settings and data</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {mounted && theme === 'dark' ? (
                  <Moon className="h-5 w-5" />
                ) : theme === 'ocean' ? (
                  <Waves className="h-5 w-5" />
                ) : theme === 'forest' ? (
                  <Trees className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the appearance of the application
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!mounted ? (
                <p className="text-sm text-muted-foreground">Loading theme settings...</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Theme</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Select your preferred theme
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={theme === 'light' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          console.log('Setting theme to light');
                          setTheme('light');
                        }}
                      >
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          console.log('Setting theme to dark');
                          setTheme('dark');
                        }}
                      >
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                      </Button>
                      <Button
                        variant={theme === 'ocean' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          console.log('Setting theme to ocean');
                          setTheme('ocean');
                        }}
                      >
                        <Waves className="mr-2 h-4 w-4" />
                        Ocean
                      </Button>
                      <Button
                        variant={theme === 'forest' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          console.log('Setting theme to forest');
                          setTheme('forest');
                        }}
                      >
                        <Trees className="mr-2 h-4 w-4" />
                        Forest
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Calendar Colors
              </CardTitle>
              <CardDescription>
                Customize the colors for different calendar event categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingColors ? (
                <p className="text-sm text-muted-foreground">Loading colors...</p>
              ) : (
                <div className="space-y-4">
                  {DEFAULT_CATEGORIES.map((category) => (
                    <div key={category.value} className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{category.name}</Label>
                      <div className="flex gap-2">
                        {AVAILABLE_COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => handleColorChange(category.value, color.value)}
                            className={`w-8 h-8 rounded-md ${color.class} transition-all hover:scale-110 ${
                              calendarColors[category.value] === color.value
                                ? 'ring-2 ring-offset-2 ring-slate-900'
                                : ''
                            }`}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {userProfile?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Transactional Email Settings
                </CardTitle>
                <CardDescription>
                  Configure SMTP for booking forms, joining instructions, and payment links
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEmailSettings ? (
                  <p className="text-sm text-muted-foreground">Loading email settings...</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="trans_smtp_host">SMTP Host</Label>
                        <div className="relative">
                          <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="trans_smtp_host"
                            value={transactionalSettings.smtp_host}
                            onChange={(e) => setTransactionalSettings({ ...transactionalSettings, smtp_host: e.target.value })}
                            placeholder="smtp.example.com"
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trans_smtp_port">SMTP Port</Label>
                        <Input
                          id="trans_smtp_port"
                          type="number"
                          value={transactionalSettings.smtp_port}
                          onChange={(e) => setTransactionalSettings({ ...transactionalSettings, smtp_port: parseInt(e.target.value) || 465 })}
                          placeholder="465"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="trans_smtp_username">SMTP Username</Label>
                        <Input
                          id="trans_smtp_username"
                          value={transactionalSettings.smtp_username}
                          onChange={(e) => setTransactionalSettings({ ...transactionalSettings, smtp_username: e.target.value })}
                          placeholder="your@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trans_smtp_password">SMTP Password</Label>
                        <div className="relative">
                          <Input
                            id="trans_smtp_password"
                            type={showTransactionalPassword ? 'text' : 'password'}
                            value={transactionalSettings.smtp_password}
                            onChange={(e) => setTransactionalSettings({ ...transactionalSettings, smtp_password: e.target.value })}
                            placeholder="Enter password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTransactionalPassword(!showTransactionalPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showTransactionalPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3">Sender Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="trans_from_email">From Email</Label>
                          <Input
                            id="trans_from_email"
                            type="email"
                            value={transactionalSettings.from_email}
                            onChange={(e) => setTransactionalSettings({ ...transactionalSettings, from_email: e.target.value })}
                            placeholder="sender@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="trans_from_name">From Name</Label>
                          <Input
                            id="trans_from_name"
                            value={transactionalSettings.from_name}
                            onChange={(e) => setTransactionalSettings({ ...transactionalSettings, from_name: e.target.value })}
                            placeholder="Company Name"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        onClick={handleSaveTransactionalSettings}
                        disabled={savingTransactional}
                      >
                        {savingTransactional ? 'Saving...' : 'Save Settings'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {userProfile?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Marketing Email Settings
                </CardTitle>
                <CardDescription>
                  Configure SMTP for marketing campaigns (can be different from transactional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEmailSettings ? (
                  <p className="text-sm text-muted-foreground">Loading email settings...</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mkt_smtp_host">SMTP Host</Label>
                        <div className="relative">
                          <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="mkt_smtp_host"
                            value={marketingSettings.smtp_host}
                            onChange={(e) => setMarketingSettings({ ...marketingSettings, smtp_host: e.target.value })}
                            placeholder="smtp.example.com"
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mkt_smtp_port">SMTP Port</Label>
                        <Input
                          id="mkt_smtp_port"
                          type="number"
                          value={marketingSettings.smtp_port}
                          onChange={(e) => setMarketingSettings({ ...marketingSettings, smtp_port: parseInt(e.target.value) || 465 })}
                          placeholder="465"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mkt_smtp_username">SMTP Username</Label>
                        <Input
                          id="mkt_smtp_username"
                          value={marketingSettings.smtp_username}
                          onChange={(e) => setMarketingSettings({ ...marketingSettings, smtp_username: e.target.value })}
                          placeholder="your@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mkt_smtp_password">SMTP Password</Label>
                        <div className="relative">
                          <Input
                            id="mkt_smtp_password"
                            type={showMarketingPassword ? 'text' : 'password'}
                            value={marketingSettings.smtp_password}
                            onChange={(e) => setMarketingSettings({ ...marketingSettings, smtp_password: e.target.value })}
                            placeholder="Enter password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowMarketingPassword(!showMarketingPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showMarketingPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3">Sender Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="mkt_from_email">From Email</Label>
                          <Input
                            id="mkt_from_email"
                            type="email"
                            value={marketingSettings.from_email}
                            onChange={(e) => setMarketingSettings({ ...marketingSettings, from_email: e.target.value })}
                            placeholder="marketing@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mkt_from_name">From Name</Label>
                          <Input
                            id="mkt_from_name"
                            value={marketingSettings.from_name}
                            onChange={(e) => setMarketingSettings({ ...marketingSettings, from_name: e.target.value })}
                            placeholder="Company Marketing"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        onClick={handleSaveMarketingSettings}
                        disabled={savingMarketing}
                      >
                        {savingMarketing ? 'Saving...' : 'Save Settings'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {userProfile?.role === 'admin' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                      Create and manage user accounts
                    </CardDescription>
                  </div>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                              {user.role}
                            </span>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setFormData({ ...formData, role: user.role });
                                setRoleDialogOpen(true);
                              }}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setPasswordDialogOpen(true);
                              }}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedUser(user);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={user.id === userProfile?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>
                Export your CRM data to CSV files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleExportLeads} variant="outline" className="w-full justify-start">
                <Download className="mr-2 h-4 w-4" />
                Export Leads
              </Button>
              <Button onClick={handleExportContacts} variant="outline" className="w-full justify-start">
                <Download className="mr-2 h-4 w-4" />
                Export Contacts
              </Button>
              <Button onClick={handleExportBookings} variant="outline" className="w-full justify-start">
                <Download className="mr-2 h-4 w-4" />
                Export Bookings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Leads</CardTitle>
              <CardDescription>
                Import leads from a CSV file. Format: name, company_name, email, phone, source, channel, training_interest (semicolon-separated), preferred_language, location, notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="csv-import">CSV File</Label>
                <Input
                  id="csv-import"
                  type="file"
                  accept=".csv"
                  onChange={handleImportLeads}
                  disabled={importing}
                />
                {importing && <p className="text-sm text-muted-foreground">Importing...</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GDPR Tools</CardTitle>
              <CardDescription>
                Data protection and privacy tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contact and lead records include GDPR consent tracking. You can export or delete individual records from their detail pages.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user account to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password (min 6 characters)"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'sales' | 'trainer') =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={processing}>
              {processing ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update role for {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newRole">New Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'sales' | 'trainer') =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRoleDialogOpen(false);
              setFormData({ email: '', password: '', confirmPassword: '', fullName: '', role: 'sales' });
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={processing}>
              {processing ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update password for {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div>
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordDialogOpen(false);
              setFormData({ ...formData, password: '', confirmPassword: '' });
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePassword} disabled={processing}>
              {processing ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.full_name}? This action cannot be undone.
              All data associated with this user will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={processing}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
