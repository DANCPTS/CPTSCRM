'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Eye, Link2, Sparkles, Loader as Loader2, Undo2, RotateCcw, ExternalLink, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, X, Globe, Mail, Phone, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

// --- Link Parsing ---

interface ParsedLink {
  id: string;
  text: string;
  href: string;
  type: 'webpage' | 'email' | 'telephone' | 'unsubscribe' | 'placeholder' | 'empty';
  isButton: boolean;
  originalHref: string;
  elementIndex: number;
}

function classifyLinkType(href: string): ParsedLink['type'] {
  if (!href || href === '#' || href === '') return 'empty';
  if (/\{\{.*?\}\}/.test(href)) return 'placeholder';
  if (/unsubscribe/i.test(href)) return 'unsubscribe';
  if (/^mailto:/i.test(href)) return 'email';
  if (/^tel:/i.test(href)) return 'telephone';
  return 'webpage';
}

function isButtonStyled(outerHtml: string): boolean {
  const lowerHtml = outerHtml.toLowerCase();
  if (/class\s*=\s*["'][^"']*btn[^"']*["']/i.test(lowerHtml)) return true;
  if (/class\s*=\s*["'][^"']*button[^"']*["']/i.test(lowerHtml)) return true;
  if (/class\s*=\s*["'][^"']*cta[^"']*["']/i.test(lowerHtml)) return true;
  if (/background-color\s*:/i.test(lowerHtml) && /padding\s*:/i.test(lowerHtml)) return true;
  if (/bgcolor\s*=/i.test(lowerHtml)) return true;
  return false;
}

function parseLinks(html: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const anchorRegex = /<a\s[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = anchorRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const innerContent = match[1];

    const hrefMatch = fullTag.match(/href\s*=\s*["']([^"']*)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';

    let text = innerContent
      .replace(/<img[^>]*alt\s*=\s*["']([^"']*)["'][^>]*>/gi, '$1')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (!text) {
      const imgAlt = innerContent.match(/<img[^>]*alt\s*=\s*["']([^"']*)["']/i);
      text = imgAlt ? imgAlt[1] : '[Image Link]';
    }

    const isBtn = isButtonStyled(fullTag);

    const parentContext = html.substring(
      Math.max(0, match.index - 300),
      Math.min(html.length, match.index + fullTag.length + 300)
    );
    const parentIsButton = isButtonStyled(parentContext);

    links.push({
      id: `link-${index}`,
      text: text.substring(0, 80),
      href,
      type: classifyLinkType(href),
      isButton: isBtn || parentIsButton,
      originalHref: href,
      elementIndex: match.index,
    });
    index++;
  }

  return links;
}

function updateLinkInHtml(html: string, link: ParsedLink, newHref: string): string {
  const anchorRegex = /<a\s[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  let currentIndex = 0;
  let targetIndex = -1;

  while ((match = anchorRegex.exec(html)) !== null) {
    if (currentIndex === links_indexOf(link)) {
      targetIndex = match.index;
      break;
    }
    currentIndex++;
  }

  if (targetIndex === -1) return html;

  const fullMatch = match![0];
  const updated = fullMatch.replace(
    /href\s*=\s*["'][^"']*["']/i,
    `href="${escapeHtmlAttr(newHref)}"`
  );
  return html.substring(0, targetIndex) + updated + html.substring(targetIndex + fullMatch.length);
}

function links_indexOf(link: ParsedLink): number {
  return parseInt(link.id.replace('link-', ''), 10);
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Sanitization ---

const DANGEROUS_TAGS = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'applet', 'noscript',
];
const EVENT_HANDLER_RE = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

function sanitizeStandaloneHtml(html: string): string {
  let result = html;

  DANGEROUS_TAGS.forEach(tag => {
    result = result.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    result = result.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), '');
    result = result.replace(new RegExp(`<\\/${tag}>`, 'gi'), '');
  });

  result = result.replace(EVENT_HANDLER_RE, '');
  result = result.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  result = result.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

  return result;
}

// --- Link Type Icons & Labels ---

function getLinkTypeIcon(type: ParsedLink['type']) {
  switch (type) {
    case 'webpage': return <Globe className="h-3.5 w-3.5 text-blue-500" />;
    case 'email': return <Mail className="h-3.5 w-3.5 text-green-500" />;
    case 'telephone': return <Phone className="h-3.5 w-3.5 text-cyan-500" />;
    case 'unsubscribe': return <LinkIcon className="h-3.5 w-3.5 text-orange-500" />;
    case 'placeholder': return <LinkIcon className="h-3.5 w-3.5 text-slate-400" />;
    case 'empty': return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  }
}

function getLinkTypeLabel(type: ParsedLink['type']): string {
  switch (type) {
    case 'webpage': return 'Webpage';
    case 'email': return 'Email';
    case 'telephone': return 'Telephone';
    case 'unsubscribe': return 'Unsubscribe';
    case 'placeholder': return 'Placeholder';
    case 'empty': return 'Missing';
  }
}

// --- Component ---

interface StandaloneHtmlEditorProps {
  html: string;
  onChange: (html: string) => void;
  subject: string;
  onSubjectChange?: (subject: string) => void;
  originalHtml?: string;
}

export function StandaloneHtmlEditor({
  html,
  onChange,
  subject,
  onSubjectChange,
  originalHtml,
}: StandaloneHtmlEditorProps) {
  const [activeTab, setActiveTab] = useState('html');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkHref, setEditingLinkHref] = useState('');
  const [editingLinkType, setEditingLinkType] = useState<string>('webpage');

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRefining, setAiRefining] = useState(false);
  const [pendingAiResult, setPendingAiResult] = useState<{
    subject: string;
    body: string;
    summary: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialHtmlRef = useRef(originalHtml || html);

  useEffect(() => {
    if (originalHtml) {
      initialHtmlRef.current = originalHtml;
    }
  }, [originalHtml]);

  const parsedLinks = useMemo(() => parseLinks(html), [html]);

  const missingDestLinks = parsedLinks.filter(l => l.type === 'empty');
  const buttonLinks = parsedLinks.filter(l => l.isButton);
  const regularLinks = parsedLinks.filter(l => !l.isButton);

  const pushUndo = useCallback((currentHtml: string) => {
    setUndoStack(prev => [...prev.slice(-19), currentHtml]);
  }, []);

  const handleHtmlChange = useCallback((newHtml: string) => {
    onChange(newHtml);
  }, [onChange]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    onChange(previous);
    toast.success('Reverted to previous version');
  }, [undoStack, onChange]);

  const handleReset = useCallback(() => {
    if (initialHtmlRef.current === html) {
      toast.info('Already at the original imported version');
      return;
    }
    pushUndo(html);
    onChange(initialHtmlRef.current);
    toast.success('Reset to original imported version');
  }, [html, onChange, pushUndo]);

  const handleTextareaBlur = useCallback(() => {
    const sanitized = sanitizeStandaloneHtml(html);
    if (sanitized !== html) {
      onChange(sanitized);
    }
  }, [html, onChange]);

  // --- Link editing ---

  const startEditingLink = (link: ParsedLink) => {
    setEditingLinkId(link.id);
    setEditingLinkHref(link.href);
    setEditingLinkType(
      link.type === 'empty' || link.type === 'placeholder' ? 'webpage' : link.type
    );
  };

  const saveLink = (link: ParsedLink) => {
    let finalHref = editingLinkHref.trim();

    if (editingLinkType === 'email' && finalHref && !finalHref.startsWith('mailto:')) {
      finalHref = `mailto:${finalHref}`;
    }
    if (editingLinkType === 'telephone' && finalHref && !finalHref.startsWith('tel:')) {
      finalHref = `tel:${finalHref}`;
    }

    if (finalHref && editingLinkType === 'webpage' && !/^https?:\/\//i.test(finalHref) && !finalHref.startsWith('{{')) {
      finalHref = `https://${finalHref}`;
    }

    pushUndo(html);
    const updated = updateLinkInHtml(html, link, finalHref);
    onChange(updated);
    setEditingLinkId(null);
    toast.success('Link updated');
  };

  const cancelEditLink = () => {
    setEditingLinkId(null);
    setEditingLinkHref('');
  };

  // --- AI refinement ---

  const handleAiRefine = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter instructions for the AI');
      return;
    }

    setAiRefining(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-marketing-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          existingSubject: subject,
          existingBody: html,
          templateMode: 'standalone_html',
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const sanitized = sanitizeStandaloneHtml(result.body);
        setPendingAiResult({
          subject: result.subject,
          body: sanitized,
          summary: aiPrompt,
        });
        setActiveTab('preview');
      } else {
        toast.error('AI refinement failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('AI refinement error:', error);
      toast.error('AI refinement failed. Please try again.');
    } finally {
      setAiRefining(false);
    }
  };

  const acceptAiChanges = () => {
    if (!pendingAiResult) return;
    pushUndo(html);
    onChange(pendingAiResult.body);
    if (onSubjectChange && pendingAiResult.subject) {
      onSubjectChange(pendingAiResult.subject);
    }
    setPendingAiResult(null);
    setAiPrompt('');
    toast.success('AI changes applied');
  };

  const discardAiChanges = () => {
    setPendingAiResult(null);
    toast.info('AI changes discarded');
  };

  const previewHtml = pendingAiResult ? pendingAiResult.body : html;

  const renderLinkRow = (link: ParsedLink) => {
    const isEditing = editingLinkId === link.id;

    return (
      <div
        key={link.id}
        className={`p-3 rounded-lg border transition-colors ${
          link.type === 'empty'
            ? 'border-red-200 bg-red-50/50'
            : isEditing
            ? 'border-blue-300 bg-blue-50/50'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            {getLinkTypeIcon(link.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-800 truncate">
                {link.text || '[No text]'}
              </span>
              {link.isButton && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  Button
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                  link.type === 'empty' ? 'border-red-300 text-red-600' : ''
                }`}
              >
                {getLinkTypeLabel(link.type)}
              </Badge>
            </div>

            {isEditing ? (
              <div className="space-y-2 mt-2">
                <div className="flex gap-2">
                  <Select value={editingLinkType} onValueChange={setEditingLinkType}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webpage">Webpage</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="telephone">Telephone</SelectItem>
                      <SelectItem value="unsubscribe">Unsubscribe</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={editingLinkHref}
                    onChange={(e) => setEditingLinkHref(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveLink(link);
                      if (e.key === 'Escape') cancelEditLink();
                    }}
                    placeholder={
                      editingLinkType === 'email' ? 'email@example.com' :
                      editingLinkType === 'telephone' ? '+44 1234 567890' :
                      editingLinkType === 'unsubscribe' ? '{{unsubscribe_url}}' :
                      'https://example.com'
                    }
                    className="h-8 text-xs flex-1"
                    autoFocus
                  />
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-xs" onClick={() => saveLink(link)}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEditLink}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-xs truncate ${
                  link.type === 'empty' ? 'text-red-500 italic' : 'text-slate-500'
                }`}>
                  {link.href || 'No destination set'}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-xs"
                    onClick={() => startEditingLink(link)}
                  >
                    Edit
                  </Button>
                  {link.href && link.type === 'webpage' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs"
                      onClick={() => window.open(link.href, '_blank', 'noopener')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* AI Refinement */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-lg p-4">
        <label className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Edit with AI
        </label>
        <p className="text-xs text-blue-700 mb-3">
          Ask the AI to change text, update links, replace images, or modify any part of the imported email.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !aiRefining && handleAiRefine()}
            placeholder='e.g., "Change the heading to Summer Training Offers" or "Make the Book Now button link to https://..."'
            className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            disabled={aiRefining}
          />
          <Button
            type="button"
            onClick={handleAiRefine}
            disabled={aiRefining || !aiPrompt.trim()}
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

      {/* AI Change Confirmation */}
      {pendingAiResult && (
        <div className="border-2 border-emerald-300 rounded-lg p-4 bg-emerald-50">
          <div className="flex items-start gap-3 mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">AI changes ready for review</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Instruction: &ldquo;{pendingAiResult.summary}&rdquo;
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                The preview below shows the updated version. Review it before accepting.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={acceptAiChanges}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Accept Changes
            </Button>
            <Button size="sm" variant="outline" onClick={discardAiChanges}>
              <X className="h-4 w-4 mr-1.5" />
              Discard Changes
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {missingDestLinks.length > 0 && (
            <Badge variant="outline" className="border-red-300 text-red-600 text-xs gap-1">
              <AlertTriangle className="h-3 w-3" />
              {missingDestLinks.length} link{missingDestLinks.length > 1 ? 's' : ''} missing destination
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="h-7 text-xs gap-1"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={html === initialHtmlRef.current}
            className="h-7 text-xs gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Original
          </Button>
        </div>
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="html" className="gap-1.5">
            <Code className="h-3.5 w-3.5" />
            HTML
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Links & Buttons
            {missingDestLinks.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {missingDestLinks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="html" className="mt-3">
          <Textarea
            ref={textareaRef}
            value={html}
            onChange={(e) => handleHtmlChange(e.target.value)}
            onBlur={handleTextareaBlur}
            className="font-mono text-xs min-h-[450px] resize-y bg-slate-50 leading-relaxed"
            placeholder="Complete HTML email document..."
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              sandbox="allow-same-origin"
              className="w-full border-0"
              style={{ height: '550px', pointerEvents: 'none' }}
            />
          </div>
        </TabsContent>

        <TabsContent value="links" className="mt-3">
          {parsedLinks.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Link2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No links found</p>
              <p className="text-xs mt-1">Add links in the HTML tab or ask the AI to insert them.</p>
            </div>
          ) : (
            <ScrollArea className="h-[450px]">
              <div className="space-y-5 pr-3">
                {/* Missing destination warning */}
                {missingDestLinks.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-800">
                        {missingDestLinks.length} link{missingDestLinks.length > 1 ? 's need' : ' needs'} a destination
                      </span>
                    </div>
                    <p className="text-xs text-red-600">
                      These links use &quot;#&quot; or have no URL. Set a destination below or ask the AI to update them.
                    </p>
                  </div>
                )}

                {/* Buttons section */}
                {buttonLinks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Buttons ({buttonLinks.length})
                    </h4>
                    <div className="space-y-2">
                      {buttonLinks.map(renderLinkRow)}
                    </div>
                  </div>
                )}

                {/* Regular links section */}
                {regularLinks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Links ({regularLinks.length})
                    </h4>
                    <div className="space-y-2">
                      {regularLinks.map(renderLinkRow)}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
