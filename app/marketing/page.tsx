'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Mail, Building2, User, Send, Sparkles, Eye, Clock, CheckCircle, XCircle, Trash2, RefreshCw, Edit2, Code, Image, Upload, Loader2 } from 'lucide-react';
import { RichTextEditor } from '@/components/rich-text-editor';
import { EmailPreview } from '@/components/email-preview';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function MarketingPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Template form
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateCategory, setTemplateCategory] = useState('general');

  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [targetType, setTargetType] = useState<'business' | 'individual'>('business');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // AI assistance
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [aiRefining, setAiRefining] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [previewTemplateOpen, setPreviewTemplateOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [savingTemplateEdit, setSavingTemplateEdit] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('marketing-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('marketing-images')
        .getPublicUrl(fileName);

      const imgTag = `<img src="${publicUrl}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
      setTemplateBody(prev => prev + '\n' + imgTag);
      toast.success('Image uploaded and inserted');
    } catch (error: any) {
      toast.error('Failed to upload image: ' + error.message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [campaignsRes, templatesRes] = await Promise.all([
        supabase
          .from('marketing_campaigns')
          .select('*, email_templates(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('email_templates')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (templatesRes.error) throw templatesRes.error;

      setCampaigns(campaignsRes.data || []);
      setTemplates(templatesRes.data || []);
    } catch (error: any) {
      toast.error('Failed to load marketing data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName || !templateSubject || !templateBody) {
      toast.error('Please fill in all template fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('email_templates')
        .insert({
          name: templateName,
          subject: templateSubject,
          body: templateBody,
          category: templateCategory,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Template created successfully');
      setTemplateDialogOpen(false);
      resetTemplateForm();
      loadData();
    } catch (error: any) {
      toast.error('Failed to create template');
      console.error(error);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || !selectedTemplateId) {
      toast.error('Please fill in all campaign fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: campaign, error } = await supabase
        .from('marketing_campaigns')
        .insert({
          name: campaignName,
          target_type: targetType,
          template_id: selectedTemplateId,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Campaign created successfully');
      setCampaignDialogOpen(false);
      resetCampaignForm();
      loadData();
    } catch (error: any) {
      toast.error('Failed to create campaign');
      console.error(error);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt) {
      toast.error('Please describe what you want the email to be about');
      return;
    }

    setAiGenerating(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-marketing-email`;
      const headers = {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTemplateSubject(result.subject);
        setTemplateBody(result.body);
        setAiDialogOpen(false);
        setTemplateDialogOpen(true);
        toast.success('Email template generated! Review and save it.');
      } else {
        toast.error('Failed to generate email: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to generate email:', error);
      toast.error('Failed to generate email. Check console for details.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleRefineWithAI = async () => {
    if (!aiRefinePrompt.trim()) {
      toast.error('Please enter instructions for the AI');
      return;
    }

    setAiRefining(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-marketing-email`;
      const headers = {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: aiRefinePrompt,
          existingSubject: templateSubject,
          existingBody: templateBody,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTemplateSubject(result.subject);
        setTemplateBody(result.body);
        setAiRefinePrompt('');
        toast.success('Email updated by AI');
      } else {
        toast.error('Failed to refine email: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Failed to refine email with AI:', error);
      toast.error('Failed to refine email. Check console for details.');
    } finally {
      setAiRefining(false);
    }
  };

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateSubject('');
    setTemplateBody('');
    setTemplateCategory('general');
    setAiRefinePrompt('');
  };

  const resetCampaignForm = () => {
    setCampaignName('');
    setTargetType('business');
    setSelectedTemplateId('');
  };

  const handlePreviewTemplate = (template: any) => {
    setPreviewTemplate(template);
    setPreviewTemplateOpen(true);
  };

  const handleOpenEditTemplate = (template: any) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateSubject(template.subject);
    setTemplateBody(template.body);
    setTemplateCategory(template.category || 'general');
    setEditTemplateDialogOpen(true);
  };

  const handleSaveTemplateEdit = async () => {
    if (!editingTemplateId || !templateName || !templateSubject || !templateBody) {
      toast.error('Please fill in all template fields');
      return;
    }

    setSavingTemplateEdit(true);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: templateName,
          subject: templateSubject,
          body: templateBody,
          category: templateCategory,
        })
        .eq('id', editingTemplateId);

      if (error) throw error;

      toast.success('Template updated successfully');
      setEditTemplateDialogOpen(false);
      setEditingTemplateId(null);
      resetTemplateForm();
      loadData();
    } catch (error: any) {
      toast.error('Failed to update template');
      console.error(error);
    } finally {
      setSavingTemplateEdit(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'sending':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-3 w-3" />;
      case 'sending':
        return <Send className="h-3 w-3" />;
      case 'scheduled':
        return <Clock className="h-3 w-3" />;
      case 'draft':
        return <Eye className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    try {
      // First delete all recipients
      const { error: recipientsError } = await supabase
        .from('campaign_recipients')
        .delete()
        .eq('campaign_id', campaignToDelete);

      if (recipientsError) throw recipientsError;

      // Then delete the campaign
      const { error: campaignError } = await supabase
        .from('marketing_campaigns')
        .delete()
        .eq('id', campaignToDelete);

      if (campaignError) throw campaignError;

      toast.success('Campaign deleted successfully');
      setDeleteConfirmOpen(false);
      setCampaignToDelete(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to delete campaign');
      console.error(error);
    }
  };

  const handleResendCampaign = async (campaignId: string) => {
    setResending(campaignId);
    try {
      // Reset all recipients to unsent
      const { error: resetError } = await supabase
        .from('campaign_recipients')
        .update({ sent: false, sent_at: null })
        .eq('campaign_id', campaignId);

      if (resetError) throw resetError;

      // Update campaign status to draft
      const { error: updateError } = await supabase
        .from('marketing_campaigns')
        .update({ status: 'draft', sent_at: null })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      toast.success('Campaign ready to resend');
      loadData();
    } catch (error: any) {
      toast.error('Failed to reset campaign');
      console.error(error);
    } finally {
      setResending(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading marketing...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Marketing</h1>
          <p className="text-slate-600 mt-1">Create and send marketing campaigns to businesses and individuals</p>
        </div>

        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="templates">Email Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button onClick={() => setCampaignDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Campaign
                </Button>
                <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </Button>
              </div>
            </div>

            {campaigns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg text-gray-600 mb-2">No campaigns yet</p>
                  <p className="text-sm text-gray-500 mb-4">Create your first marketing campaign</p>
                  <Button onClick={() => setCampaignDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => router.push(`/marketing/${campaign.id}`)}>
                          <CardTitle className="text-lg mb-2">{campaign.name}</CardTitle>
                          <div className="flex items-center gap-2 mb-2">
                            {campaign.target_type === 'business' ? (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                Businesses
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Individuals
                              </Badge>
                            )}
                            <Badge className={getStatusColor(campaign.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(campaign.status)}
                                {campaign.status}
                              </span>
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {campaign.status === 'sent' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResendCampaign(campaign.id);
                              }}
                              disabled={resending === campaign.id}
                              title="Resend campaign"
                            >
                              <RefreshCw className={`h-4 w-4 ${resending === campaign.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampaignToDelete(campaign.id);
                              setDeleteConfirmOpen(true);
                            }}
                            title="Delete campaign"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="cursor-pointer" onClick={() => router.push(`/marketing/${campaign.id}`)}>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-slate-500">Template:</span>
                          <span className="ml-2 font-medium">{campaign.email_templates?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Recipients:</span>
                          <span className="ml-2 font-medium">{campaign.recipients_count || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Created:</span>
                          <span className="ml-2 font-medium">
                            {format(new Date(campaign.created_at), 'PP')}
                          </span>
                        </div>
                        {campaign.sent_at && (
                          <div>
                            <span className="text-slate-500">Sent:</span>
                            <span className="ml-2 font-medium">
                              {format(new Date(campaign.sent_at), 'PP')}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setTemplateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </div>

            {templates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg text-gray-600 mb-2">No templates yet</p>
                  <p className="text-sm text-gray-500 mb-4">Create your first email template</p>
                  <Button onClick={() => setTemplateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">{template.category}</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreviewTemplate(template)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditTemplate(template)}
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Subject</div>
                          <p className="font-medium text-sm">{template.subject}</p>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Body Preview</div>
                          <div
                            className="text-sm text-slate-600 line-clamp-3 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: template.body }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 pt-2">
                          Created {format(new Date(template.created_at), 'PP')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder="e.g., Spring Course Promotion"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="template-category">Category</Label>
                <Select value={templateCategory} onValueChange={setTemplateCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="course_promotion">Course Promotion</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="special_offer">Special Offer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="template-subject">Email Subject</Label>
              <Input
                id="template-subject"
                placeholder="e.g., New CPCS Training Courses Available"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
              />
            </div>

            {(templateSubject || templateBody) && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-lg p-4">
                <label className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Refine with AI
                </label>
                <p className="text-xs text-blue-700 mb-3">
                  Describe how you want to change the email (e.g., "make it shorter", "add urgency", "include a discount")
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiRefinePrompt}
                    onChange={(e) => setAiRefinePrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !aiRefining && handleRefineWithAI()}
                    placeholder="e.g., Make the tone more friendly and add a 10% discount mention..."
                    className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                    disabled={aiRefining}
                  />
                  <Button
                    type="button"
                    onClick={handleRefineWithAI}
                    disabled={aiRefining || !aiRefinePrompt.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {aiRefining ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Refining...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Apply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label>Email Body</Label>
              <Tabs defaultValue="editor" className="w-full mt-1">
                <TabsList className="mb-2">
                  <TabsTrigger value="editor">Visual Editor</TabsTrigger>
                  <TabsTrigger value="html" className="gap-1">
                    <Code className="h-3.5 w-3.5" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="editor">
                  <RichTextEditor
                    value={templateBody}
                    onChange={setTemplateBody}
                    placeholder="Write your email content here..."
                    minHeight="250px"
                  />
                </TabsContent>
                <TabsContent value="html">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Image className="h-4 w-4" />
                        <span>Add images using HTML or upload directly</span>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={uploadingImage} asChild>
                          <span>
                            {uploadingImage ? (
                              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-1.5" />
                            )}
                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                          </span>
                        </Button>
                      </label>
                    </div>
                    <Textarea
                      value={templateBody}
                      onChange={(e) => setTemplateBody(e.target.value)}
                      placeholder="Enter your HTML content here..."
                      className="font-mono text-sm min-h-[300px] resize-y"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="preview">
                  <EmailPreview
                    subject={templateSubject}
                    body={templateBody}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setTemplateDialogOpen(false);
              resetTemplateForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Marketing Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., Spring 2025 Course Launch"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="target-type">Target Audience</Label>
              <Select value={targetType} onValueChange={(val: any) => setTargetType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Businesses
                    </div>
                  </SelectItem>
                  <SelectItem value="individual">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Individual Clients
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="template-select">Email Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCampaignDialogOpen(false);
              resetCampaignForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign}>
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this campaign? This will also remove all recipients. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setCampaignToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCampaign}>
              Delete Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate Email with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ai-prompt">What do you want the email to be about?</Label>
              <Textarea
                id="ai-prompt"
                placeholder="e.g., Promote our new CPCS excavator training course starting in March, highlight the benefits and certification"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAiDialogOpen(false);
              setAiPrompt('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleGenerateWithAI} disabled={aiGenerating}>
              <Sparkles className="mr-2 h-4 w-4" />
              {aiGenerating ? 'Generating...' : 'Generate Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewTemplateOpen} onOpenChange={setPreviewTemplateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview - {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <EmailPreview
              subject={previewTemplate?.subject || ''}
              body={previewTemplate?.body || ''}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editTemplateDialogOpen} onOpenChange={(open) => {
        setEditTemplateDialogOpen(open);
        if (!open) {
          setEditingTemplateId(null);
          resetTemplateForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-template-name">Template Name</Label>
                <Input
                  id="edit-template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-template-category">Category</Label>
                <Select value={templateCategory} onValueChange={setTemplateCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="course_promotion">Course Promotion</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="special_offer">Special Offer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-template-subject">Subject</Label>
              <Input
                id="edit-template-subject"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
              />
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-lg p-4">
              <label className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Refine with AI
              </label>
              <p className="text-xs text-blue-700 mb-3">
                Describe how you want to change the email (e.g., "make it shorter", "add urgency", "include a discount")
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiRefinePrompt}
                  onChange={(e) => setAiRefinePrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !aiRefining && handleRefineWithAI()}
                  placeholder="e.g., Make the tone more friendly and add a 10% discount mention..."
                  className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  disabled={aiRefining}
                />
                <Button
                  type="button"
                  onClick={handleRefineWithAI}
                  disabled={aiRefining || !aiRefinePrompt.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {aiRefining ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Apply
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label>Email Body</Label>
              <Tabs defaultValue="editor" className="w-full mt-1">
                <TabsList className="mb-2">
                  <TabsTrigger value="editor">Visual Editor</TabsTrigger>
                  <TabsTrigger value="html" className="gap-1">
                    <Code className="h-3.5 w-3.5" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="editor">
                  <RichTextEditor
                    value={templateBody}
                    onChange={setTemplateBody}
                    placeholder="Write your email content here..."
                    minHeight="300px"
                  />
                </TabsContent>
                <TabsContent value="html">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Image className="h-4 w-4" />
                        <span>Add images using HTML or upload directly</span>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={uploadingImage} asChild>
                          <span>
                            {uploadingImage ? (
                              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-1.5" />
                            )}
                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                          </span>
                        </Button>
                      </label>
                    </div>
                    <Textarea
                      value={templateBody}
                      onChange={(e) => setTemplateBody(e.target.value)}
                      placeholder="Enter your HTML content here..."
                      className="font-mono text-sm min-h-[350px] resize-y"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="preview">
                  <EmailPreview
                    subject={templateSubject}
                    body={templateBody}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setEditTemplateDialogOpen(false);
              setEditingTemplateId(null);
              resetTemplateForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplateEdit} disabled={savingTemplateEdit}>
              {savingTemplateEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
