'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Eye, Link2, Sparkles, Loader as Loader2, Undo2, RotateCcw, ExternalLink, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, X, Globe, Mail, Phone, Link as LinkIcon, Search, AlignLeft, Copy, Maximize2, Minimize2, MousePointerClick, ShieldCheck, Link as Link2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { VisualEmailEditor } from '@/components/visual-email-editor';

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
  const targetLinkIndex = parseInt(link.id.replace('link-', ''), 10);

  while ((match = anchorRegex.exec(html)) !== null) {
    if (currentIndex === targetLinkIndex) {
      const fullMatch = match[0];
      const updated = fullMatch.replace(
        /href\s*=\s*["'][^"']*["']/i,
        `href="${escapeHtmlAttr(newHref)}"`
      );
      return html.substring(0, match.index) + updated + html.substring(match.index + fullMatch.length);
    }
    currentIndex++;
  }

  return html;
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

function sanitizeStandaloneHtml(html: string): { sanitized: string; removedCount: number } {
  let result = html;
  let removedCount = 0;

  DANGEROUS_TAGS.forEach(tag => {
    const openClose = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfClose = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    const closeOnly = new RegExp(`<\\/${tag}>`, 'gi');
    const m1 = result.match(openClose);
    const m2 = result.match(selfClose);
    if (m1) removedCount += m1.length;
    if (m2) removedCount += m2.length;
    result = result.replace(openClose, '');
    result = result.replace(selfClose, '');
    result = result.replace(closeOnly, '');
  });

  const eventMatches = result.match(EVENT_HANDLER_RE);
  if (eventMatches) removedCount += eventMatches.length;
  result = result.replace(EVENT_HANDLER_RE, '');

  const jsHrefs = result.match(/href\s*=\s*["']javascript:[^"']*["']/gi);
  if (jsHrefs) removedCount += jsHrefs.length;
  result = result.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  result = result.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

  return { sanitized: result, removedCount };
}

// --- Simple HTML formatter ---

function formatHtml(html: string): string {
  let formatted = '';
  let indent = 0;
  const lines = html
    .replace(/>\s*</g, '>\n<')
    .split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^<\//.test(line)) indent = Math.max(0, indent - 1);

    formatted += '  '.repeat(indent) + line + '\n';

    if (/^<[a-z][^>]*[^/]>$/i.test(line) &&
        !/^<(?:br|hr|img|input|meta|link|col|area|base|command|embed|keygen|param|source|track|wbr)/i.test(line)) {
      indent++;
    }
  }

  return formatted.trimEnd();
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
  // draftHtml holds the live, unsanitized working copy the user types into.
  // We sync it FROM the parent html prop only when the parent drives a change
  // (AI accept, link save, undo, reset). During typing, draftHtml is authoritative.
  const [draftHtml, setDraftHtml] = useState(html);
  const [activeTab, setActiveTab] = useState('html');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkHref, setEditingLinkHref] = useState('');
  const [editingLinkType, setEditingLinkType] = useState<string>('webpage');
  const [expanded, setExpanded] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [sanitizeWarning, setSanitizeWarning] = useState<string | null>(null);

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRefining, setAiRefining] = useState(false);
  const [pendingAiResult, setPendingAiResult] = useState<{
    subject: string;
    body: string;
    summary: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const initialHtmlRef = useRef(originalHtml || html);
  const lastParentHtml = useRef(html);

  // Track whether draftHtml has diverged from the parent
  const draftDirty = useRef(false);

  useEffect(() => {
    if (originalHtml) {
      initialHtmlRef.current = originalHtml;
    }
  }, [originalHtml]);

  // Sync draftHtml when the parent drives a change (AI, link save, undo, reset)
  useEffect(() => {
    if (html !== lastParentHtml.current) {
      lastParentHtml.current = html;
      setDraftHtml(html);
      draftDirty.current = false;
    }
  }, [html]);

  // Commit draftHtml to parent when leaving the HTML tab
  const commitDraft = useCallback(() => {
    if (draftDirty.current && draftHtml !== html) {
      setUndoStack(prev => [...prev.slice(-19), html]);
      onChange(draftHtml);
      lastParentHtml.current = draftHtml;
      draftDirty.current = false;
    }
  }, [draftHtml, html, onChange]);

  const handleTabChange = useCallback((newTab: string) => {
    if (activeTab === 'html' && newTab !== 'html') {
      commitDraft();
    }
    setActiveTab(newTab);
  }, [activeTab, commitDraft]);

  // Parse links from the current working html (committed version)
  const parsedLinks = useMemo(() => parseLinks(html), [html]);
  const missingDestLinks = parsedLinks.filter(l => l.type === 'empty');
  const buttonLinks = parsedLinks.filter(l => l.isButton);
  const regularLinks = parsedLinks.filter(l => !l.isButton);

  const pushUndo = useCallback((currentHtml: string) => {
    setUndoStack(prev => [...prev.slice(-19), currentHtml]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    onChange(previous);
    lastParentHtml.current = previous;
    setDraftHtml(previous);
    draftDirty.current = false;
    toast.success('Reverted to previous version');
  }, [undoStack, onChange]);

  const handleReset = useCallback(() => {
    if (initialHtmlRef.current === html && initialHtmlRef.current === draftHtml) {
      toast.info('Already at the original imported version');
      return;
    }
    pushUndo(html);
    onChange(initialHtmlRef.current);
    lastParentHtml.current = initialHtmlRef.current;
    setDraftHtml(initialHtmlRef.current);
    draftDirty.current = false;
    toast.success('Reset to original imported version');
  }, [html, draftHtml, onChange, pushUndo]);

  // --- Toolbar actions ---

  const handleFind = useCallback(() => {
    setFindOpen(prev => !prev);
    setTimeout(() => findInputRef.current?.focus(), 50);
  }, []);

  const handleFindNext = useCallback(() => {
    if (!findQuery || !textareaRef.current) return;
    const ta = textareaRef.current;
    const text = ta.value;
    const startPos = ta.selectionEnd || 0;
    const idx = text.toLowerCase().indexOf(findQuery.toLowerCase(), startPos);
    if (idx !== -1) {
      ta.focus();
      ta.setSelectionRange(idx, idx + findQuery.length);
    } else {
      const wrapIdx = text.toLowerCase().indexOf(findQuery.toLowerCase(), 0);
      if (wrapIdx !== -1) {
        ta.focus();
        ta.setSelectionRange(wrapIdx, wrapIdx + findQuery.length);
      } else {
        toast.info('Not found');
      }
    }
  }, [findQuery]);

  const handleFormat = useCallback(() => {
    pushUndo(draftHtml);
    const formatted = formatHtml(draftHtml);
    setDraftHtml(formatted);
    draftDirty.current = true;
    toast.success('HTML formatted');
  }, [draftHtml, pushUndo]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draftHtml);
      toast.success('HTML copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [draftHtml]);

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
    lastParentHtml.current = updated;
    setDraftHtml(updated);
    draftDirty.current = false;
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

    // Commit any draft edits first
    if (draftDirty.current && draftHtml !== html) {
      pushUndo(html);
      onChange(draftHtml);
      lastParentHtml.current = draftHtml;
      draftDirty.current = false;
    }

    const currentHtml = draftDirty.current ? draftHtml : html;

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
          existingBody: currentHtml,
          templateMode: 'standalone_html',
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setPendingAiResult({
          subject: result.subject,
          body: result.body,
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
    const { sanitized } = sanitizeStandaloneHtml(pendingAiResult.body);
    onChange(sanitized);
    lastParentHtml.current = sanitized;
    setDraftHtml(sanitized);
    draftDirty.current = false;
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

  const PREVIEW_UNSUBSCRIBE_URL = '#unsubscribe-preview';

  const hasUnsubscribeTag = useCallback((source: string) => {
    return /\{\{unsubscribe_url\}\}/i.test(source);
  }, []);

  const replaceUnsubscribeForPreview = useCallback((source: string) => {
    return source.replace(/\{\{unsubscribe_url\}\}/gi, PREVIEW_UNSUBSCRIBE_URL);
  }, []);

  const currentHtmlHasUnsubscribe = useMemo(() => {
    const source = draftDirty.current ? draftHtml : html;
    return hasUnsubscribeTag(source);
  }, [html, draftHtml, hasUnsubscribeTag]);

  // Build the preview HTML — sanitize a copy, never the live draft
  const previewHtml = useMemo(() => {
    const source = pendingAiResult ? pendingAiResult.body : (activeTab === 'preview' && draftDirty.current ? draftHtml : html);
    const { sanitized, removedCount } = sanitizeStandaloneHtml(source);
    if (removedCount > 0 && !pendingAiResult) {
      setSanitizeWarning(`${removedCount} unsafe element(s) will be removed when you save.`);
    } else {
      setSanitizeWarning(null);
    }
    return replaceUnsubscribeForPreview(sanitized);
  }, [pendingAiResult, html, draftHtml, activeTab, replaceUnsubscribeForPreview]);

  // --- Expose a save-preparation hook for the parent ---
  // The parent calls onChange; we make sure the latest draft is committed.
  // This is handled via commitDraft on tab change and via the onBlur below.

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

  const editorHeight = expanded ? 'min-h-[700px]' : 'min-h-[450px]';

  return (
    <div className="space-y-4">
      {/* AI Refinement */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-blue-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Edit with AI
          </label>
          {/* Unsubscribe link status indicator */}
          {currentHtmlHasUnsubscribe ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              <ShieldCheck className="h-3 w-3" />
              Unsubscribe link found
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              No unsubscribe link
            </span>
          )}
        </div>
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
            onClick={() => {
              if (currentHtmlHasUnsubscribe) {
                setActiveTab('links');
                toast.info('Your email already has an unsubscribe link — highlighted in the Links tab.');
                return;
              }
              setAiPrompt('Add an unsubscribe link to the existing footer. Use href="{{unsubscribe_url}}" and text "unsubscribe here". Preserve all existing footer content and styling.');
              toast.info('Unsubscribe instruction ready — click Apply to let AI add it.');
            }}
            disabled={aiRefining}
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50 gap-1.5 shrink-0"
          >
            <Link2Icon className="h-3.5 w-3.5" />
            {currentHtmlHasUnsubscribe ? 'View Link' : 'Add Unsubscribe'}
          </Button>
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

      {/* Sanitization warning */}
      {sanitizeWarning && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">{sanitizeWarning}</p>
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
            disabled={html === initialHtmlRef.current && draftHtml === initialHtmlRef.current}
            className="h-7 text-xs gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Original
          </Button>
        </div>
      </div>

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="visual" className="gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5" />
            Visual Editor
          </TabsTrigger>
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

        <TabsContent value="visual" className="mt-3">
          <VisualEmailEditor
            html={activeTab === 'visual' && draftDirty.current ? draftHtml : html}
            onUpdate={(updatedHtml) => {
              pushUndo(html);
              onChange(updatedHtml);
              lastParentHtml.current = updatedHtml;
              setDraftHtml(updatedHtml);
              draftDirty.current = false;
            }}
            expanded={expanded}
          />
        </TabsContent>

        <TabsContent value="html" className="mt-3">
          {/* Editor toolbar */}
          <div className="flex items-center gap-1 mb-2 border-b pb-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1 text-slate-600"
              onClick={handleFind}
            >
              <Search className="h-3 w-3" />
              Find
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1 text-slate-600"
              onClick={handleFormat}
            >
              <AlignLeft className="h-3 w-3" />
              Format
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1 text-slate-600"
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3" />
              Copy
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1 text-slate-600"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          {/* Find bar */}
          {findOpen && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg border">
              <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <input
                ref={findInputRef}
                type="text"
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFindNext();
                  if (e.key === 'Escape') { setFindOpen(false); textareaRef.current?.focus(); }
                }}
                placeholder="Search in HTML..."
                className="flex-1 text-sm bg-transparent border-none outline-none"
              />
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleFindNext}>
                Next
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setFindOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* The actual editable textarea */}
          <textarea
            ref={textareaRef}
            value={draftHtml}
            onChange={(e) => {
              setDraftHtml(e.target.value);
              draftDirty.current = true;
            }}
            onBlur={() => {
              // Commit draft to parent on blur so Preview/Links see the latest edits
              if (draftDirty.current && draftHtml !== html) {
                setUndoStack(prev => [...prev.slice(-19), html]);
                onChange(draftHtml);
                lastParentHtml.current = draftHtml;
                draftDirty.current = false;
              }
            }}
            className={`w-full ${editorHeight} resize-y rounded-md border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            placeholder="Complete HTML email document..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            wrap="off"
            style={{ tabSize: 2, overflowX: 'auto', whiteSpace: 'pre' }}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          {currentHtmlHasUnsubscribe && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>The unsubscribe link below uses a preview placeholder. When sent, each recipient will get a unique, working unsubscribe URL.</span>
            </div>
          )}
          <div
            className="border rounded-lg overflow-hidden bg-white"
            style={{ height: expanded ? '70vh' : '55vh', minHeight: 360, overscrollBehavior: 'contain' }}
          >
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              sandbox="allow-same-origin"
              scrolling="yes"
              className="w-full h-full border-0"
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
