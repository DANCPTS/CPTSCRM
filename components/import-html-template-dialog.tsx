'use client';

import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Upload, Loader as Loader2, Smartphone, Monitor, Code, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, FileCode2, ArrowLeft } from 'lucide-react';

// --- HTML Sanitization & Processing ---

const DANGEROUS_TAGS = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'applet', 'form', 'input', 'select', 'button', 'textarea',
  'noscript',
];

const EVENT_HANDLER_RE = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

function sanitizeHtml(rawHtml: string, baseUrl?: string): {
  html: string;
  title: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];

  let title: string | null = null;
  const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  let html = rawHtml;

  DANGEROUS_TAGS.forEach(tag => {
    const openClose = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfClose = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    const closeOnly = new RegExp(`<\\/${tag}>`, 'gi');
    if (openClose.test(html) || selfClose.test(html)) {
      warnings.push(`Removed <${tag}> elements for safety`);
    }
    html = html.replace(openClose, '');
    html = html.replace(selfClose, '');
    html = html.replace(closeOnly, '');
  });

  if (EVENT_HANDLER_RE.test(html)) {
    warnings.push('Removed event handler attributes (onclick, onload, etc.)');
  }
  html = html.replace(EVENT_HANDLER_RE, '');

  html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  html = html.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  html = html.replace(/action\s*=\s*["']javascript:[^"']*["']/gi, 'action=""');

  html = html.replace(/<!--[\s\S]*?-->/g, '');

  if (baseUrl) {
    try {
      const base = new URL(baseUrl);

      html = html.replace(
        /(src|href|background)\s*=\s*["'](?!(?:https?:|data:|mailto:|tel:|#|{{))((?:\/\/|\/)[^"']*|(?!\/)[^"':]*?(?:\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|html|htm))[^"']*)/gi,
        (match, attr, path) => {
          try {
            const absolute = new URL(path, base).toString();
            return `${attr}="${absolute}"`;
          } catch {
            return match;
          }
        }
      );

      html = html.replace(
        /url\s*\(\s*["']?(?!(?:https?:|data:))((?:\/\/|\/)[^"')]*|(?!\/)[^"')]*?)/gi,
        (match, path) => {
          try {
            const absolute = new URL(path, base).toString();
            return `url("${absolute}"`;
          } catch {
            return match;
          }
        }
      );
    } catch {
      // invalid base URL, skip conversion
    }
  }

  const hasUnsubscribe =
    /unsubscribe/i.test(html) ||
    /\{\{unsubscribe_url\}\}/i.test(html);

  if (!hasUnsubscribe) {
    warnings.push('No unsubscribe link detected. One will be required before sending.');
  }

  const imgWithoutAlt = (html.match(/<img(?![^>]*alt\s*=)[^>]*>/gi) || []).length;
  if (imgWithoutAlt > 0) {
    warnings.push(`${imgWithoutAlt} image(s) missing alt text`);
  }

  return { html, title, warnings };
}

// --- Component ---

interface ImportHtmlTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: (data: {
    html: string;
    subject: string;
    name: string;
    sourceUrl: string | null;
    generationMode: string;
    templateMode: 'standalone_html';
  }) => void;
}

type Step = 'import' | 'preview';

export function ImportHtmlTemplateDialog({
  open,
  onOpenChange,
  onUseTemplate,
}: ImportHtmlTemplateDialogProps) {
  const [step, setStep] = useState<Step>('import');
  const [importMethod, setImportMethod] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sanitizedHtml, setSanitizedHtml] = useState('');
  const [detectedTitle, setDetectedTitle] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | 'source'>('desktop');
  const [generationMode, setGenerationMode] = useState('import_only');
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('import');
    setImportMethod('url');
    setUrl('');
    setLoading(false);
    setError(null);
    setSanitizedHtml('');
    setDetectedTitle(null);
    setWarnings([]);
    setSourceUrl(null);
    setPreviewMode('desktop');
    setGenerationMode('import_only');
    setTemplateName('');
    setTemplateSubject('');
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) reset();
    onOpenChange(newOpen);
  };

  const processHtml = (rawHtml: string, baseUrl?: string, fileName?: string) => {
    const result = sanitizeHtml(rawHtml, baseUrl);

    setSanitizedHtml(result.html);
    setDetectedTitle(result.title);
    setWarnings(result.warnings);
    setSourceUrl(baseUrl || null);
    setTemplateName(result.title || fileName || 'Imported Template');
    setTemplateSubject(result.title || '');
    setStep('preview');
  };

  const handleFetchUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com/email.html)');
      return;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      setError('Only http:// and https:// URLs are supported');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fetch-html-template`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmed }),
      });

      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Failed to fetch the URL');
        return;
      }

      processHtml(result.html, result.fetchedUrl || trimmed);
    } catch (err: unknown) {
      setError(
        `Network error: ${err instanceof Error ? err.message : 'Could not reach the server'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setError('Please select an .html or .htm file');
      e.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('File is too large (maximum 2 MB)');
      e.target.value = '';
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      processHtml(text, undefined, file.name.replace(/\.html?$/i, ''));
    } catch {
      setError('Failed to read the file');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleUseTemplate = () => {
    onUseTemplate({
      html: sanitizedHtml,
      subject: templateSubject,
      name: templateName,
      sourceUrl,
      generationMode,
      templateMode: 'standalone_html',
    });
    handleOpenChange(false);
  };

  const renderPreviewFrame = (width: string) => (
    <div
      className="border rounded-lg overflow-hidden bg-white mx-auto transition-all duration-300"
      style={{ width, maxWidth: '100%' }}
    >
      <iframe
        srcDoc={sanitizedHtml}
        title="Email preview"
        sandbox="allow-same-origin"
        className="w-full border-0"
        style={{ height: '500px', pointerEvents: 'none' }}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'preview' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 mr-1"
                onClick={() => setStep('import')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <FileCode2 className="h-5 w-5" />
            {step === 'import' ? 'Import HTML Template' : 'Preview Imported Template'}
          </DialogTitle>
        </DialogHeader>

        {step === 'import' && (
          <div className="flex-1 overflow-auto space-y-6 py-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`p-4 border rounded-lg text-left transition-all ${
                  importMethod === 'url'
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => { setImportMethod('url'); setError(null); }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Globe className="h-5 w-5 text-slate-600" />
                  <span className="font-medium text-sm">Import from URL</span>
                </div>
                <p className="text-xs text-slate-500">
                  Paste a public link to an HTML email template
                </p>
              </button>
              <button
                type="button"
                className={`p-4 border rounded-lg text-left transition-all ${
                  importMethod === 'file'
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => { setImportMethod('file'); setError(null); }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Upload className="h-5 w-5 text-slate-600" />
                  <span className="font-medium text-sm">Upload HTML File</span>
                </div>
                <p className="text-xs text-slate-500">
                  Upload a .html file from your computer
                </p>
              </button>
            </div>

            {importMethod === 'url' ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="import-url">Template URL</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      id="import-url"
                      type="url"
                      placeholder="https://example.com/email-template.html"
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setError(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && !loading && handleFetchUrl()}
                      className="flex-1"
                    />
                    <Button onClick={handleFetchUrl} disabled={loading || !url.trim()}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        'Fetch'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Enter a public http:// or https:// URL to an HTML email template.
                    The page will be fetched securely from the server.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>HTML File</Label>
                  <div
                    className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-slate-300 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {loading ? (
                      <Loader2 className="h-8 w-8 text-slate-400 mx-auto animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                        <p className="text-sm font-medium text-slate-600">
                          Click to select an HTML file
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          .html or .htm files up to 2 MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 overflow-auto space-y-4 py-2">
            {warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">
                    {warnings.length} notice{warnings.length > 1 ? 's' : ''}
                  </span>
                </div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <span className="mt-0.5">-</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tpl-name">Template Name</Label>
                <Input
                  id="tpl-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Newsletter Template"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="tpl-subject">Email Subject</Label>
                <Input
                  id="tpl-subject"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  placeholder="e.g., Your Monthly Update"
                  className="mt-1"
                />
              </div>
            </div>

            {detectedTitle && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Detected title: {detectedTitle}
                </Badge>
                {sourceUrl && (
                  <Badge variant="outline" className="text-xs truncate max-w-[300px]">
                    <Globe className="h-3 w-3 mr-1 flex-shrink-0" />
                    {new URL(sourceUrl).hostname}
                  </Badge>
                )}
              </div>
            )}

            <div>
              <Label>How should the AI use this template?</Label>
              <Select value={generationMode} onValueChange={setGenerationMode}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="import_only">Import without rewriting</SelectItem>
                  <SelectItem value="rewrite_content">Keep template design and rewrite content</SelectItem>
                  <SelectItem value="inspiration">Use template as inspiration</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {generationMode === 'import_only' &&
                  'Use the template exactly as imported. You can edit it manually afterward.'}
                {generationMode === 'rewrite_content' &&
                  'The AI will replace the marketing copy while preserving the layout, styling, and structure.'}
                {generationMode === 'inspiration' &&
                  'The AI will use this as a reference for style and tone when generating new content.'}
              </p>
            </div>

            <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as typeof previewMode)}>
              <TabsList>
                <TabsTrigger value="desktop" className="gap-1.5">
                  <Monitor className="h-3.5 w-3.5" />
                  Desktop
                </TabsTrigger>
                <TabsTrigger value="mobile" className="gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  Mobile
                </TabsTrigger>
                <TabsTrigger value="source" className="gap-1.5">
                  <Code className="h-3.5 w-3.5" />
                  Source
                </TabsTrigger>
              </TabsList>

              <TabsContent value="desktop" className="mt-3">
                {renderPreviewFrame('100%')}
              </TabsContent>

              <TabsContent value="mobile" className="mt-3">
                <div className="flex justify-center">
                  {renderPreviewFrame('375px')}
                </div>
              </TabsContent>

              <TabsContent value="source" className="mt-3">
                <Textarea
                  value={sanitizedHtml}
                  readOnly
                  className="font-mono text-xs min-h-[400px] resize-y bg-slate-50"
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="pt-4 border-t">
          {step === 'import' ? (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleUseTemplate} disabled={!templateName.trim()}>
                Use This Template
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
