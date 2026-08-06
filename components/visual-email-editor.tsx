'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Type, Link2, ImageIcon, X, Upload, Loader2, AlertTriangle,
  Replace,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// ---- Types ----

interface SelectedElement {
  type: 'text' | 'button' | 'image';
  tagName: string;
  path: number[];
  text: string;
  href: string;
  src: string;
  alt: string;
  styles: Record<string, string>;
  parentLinkHref: string;
  childCount: number;
}

interface VisualEmailEditorProps {
  html: string;
  onUpdate: (html: string) => void;
  expanded?: boolean;
}

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---- Script injected into the iframe ----

const EDITOR_SCRIPT = `
(function() {
  var SELECTABLE = 'h1,h2,h3,h4,h5,h6,p,span,a,td,th,img,button,li,strong,em,b,i,u,label,div';
  var selected = null;
  var overlayEl = null;

  function createOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = '__ve_overlay';
    overlayEl.style.cssText = 'position:absolute;pointer-events:none;border:2px solid #2563eb;border-radius:3px;z-index:999999;transition:all 0.15s ease;box-shadow:0 0 0 1px rgba(37,99,235,0.2);display:none;';
    document.body.appendChild(overlayEl);
  }

  function positionOverlay(el) {
    if (!overlayEl) createOverlay();
    var r = el.getBoundingClientRect();
    overlayEl.style.left = (r.left + window.scrollX - 2) + 'px';
    overlayEl.style.top = (r.top + window.scrollY - 2) + 'px';
    overlayEl.style.width = (r.width + 4) + 'px';
    overlayEl.style.height = (r.height + 4) + 'px';
    overlayEl.style.display = 'block';
  }

  function getPath(el) {
    var path = [];
    var node = el;
    while (node && node !== document.documentElement) {
      var parent = node.parentElement;
      if (!parent) break;
      var idx = Array.prototype.indexOf.call(parent.children, node);
      path.unshift(idx);
      node = parent;
    }
    return path;
  }

  function getClosestEditable(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    var tag = el.tagName.toLowerCase();
    if (el.id === '__ve_overlay') return null;
    if (el.matches && el.matches(SELECTABLE)) {
      if ((tag === 'td' || tag === 'th') && el.querySelector('h1,h2,h3,h4,h5,h6,p,a,img,span')) {
        return null;
      }
      return el;
    }
    return getClosestEditable(el.parentElement);
  }

  function classify(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'img') return 'image';
    if (tag === 'a' || tag === 'button') return 'button';
    var parentLink = el.closest('a');
    if (parentLink && (parentLink.querySelector('img') !== el)) return 'button';
    return 'text';
  }

  function getInlineStyles(el) {
    var cs = window.getComputedStyle(el);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      textDecoration: cs.textDecoration,
      textAlign: cs.textAlign,
      borderRadius: cs.borderRadius,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      width: el.getAttribute('width') || cs.width,
    };
  }

  function serializeAndSend() {
    var overlay = document.getElementById('__ve_overlay');
    if (overlay) overlay.style.display = 'none';
    var scripts = document.querySelectorAll('script[data-ve-injected]');
    scripts.forEach(function(s) { s.remove(); });
    if (overlay) overlay.remove();
    overlayEl = null;

    var doctype = document.doctype;
    var dt = doctype ? '<!DOCTYPE ' + doctype.name + '>' : '<!DOCTYPE html>';
    var serialized = dt + '\\n' + document.documentElement.outerHTML;

    window.parent.postMessage({ type: 've-serialized', html: serialized }, '*');
    selected = null;
  }

  function resolveTarget(path) {
    var target = document.documentElement;
    for (var i = 0; i < path.length; i++) {
      if (!target || !target.children[path[i]]) return null;
      target = target.children[path[i]];
    }
    return target;
  }

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var target = getClosestEditable(e.target);
    if (!target) return;

    selected = target;
    createOverlay();
    positionOverlay(target);

    var parentLink = target.closest('a');
    var type = classify(target);
    var tag = target.tagName.toLowerCase();

    var data = {
      type: type,
      tagName: tag,
      path: getPath(target),
      text: target.textContent || '',
      href: (tag === 'a' ? target.getAttribute('href') : '') || '',
      src: (tag === 'img' ? target.getAttribute('src') : '') || '',
      alt: (tag === 'img' ? target.getAttribute('alt') : '') || '',
      styles: getInlineStyles(target),
      parentLinkHref: (parentLink && tag !== 'a') ? (parentLink.getAttribute('href') || '') : '',
      childCount: target.children.length,
    };

    window.parent.postMessage({ type: 've-select', data: data }, '*');
  }, true);

  document.addEventListener('click', function(e) { e.preventDefault(); }, false);
  var allLinks = document.querySelectorAll('a');
  allLinks.forEach(function(a) { a.addEventListener('click', function(e) { e.preventDefault(); }); });

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 've-update') return;
    var d = e.data;
    var target = d.path && d.path.length ? resolveTarget(d.path) : null;
    if (!target) return;

    if (d.prop === 'text' && target.tagName.toLowerCase() !== 'img') {
      var firstText = null;
      for (var c = 0; c < target.childNodes.length; c++) {
        if (target.childNodes[c].nodeType === 3 && target.childNodes[c].textContent.trim()) {
          firstText = target.childNodes[c]; break;
        }
      }
      if (firstText) firstText.textContent = d.value;
      else if (!target.children.length) target.textContent = d.value;
      else {
        var deepest = target;
        while (deepest.children.length === 1 && !deepest.children[0].matches('img')) {
          deepest = deepest.children[0];
        }
        if (!deepest.children.length) deepest.textContent = d.value;
        else {
          var tw = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
          var tn = tw.nextNode();
          if (tn) tn.textContent = d.value;
        }
      }
    }
    else if (d.prop === 'href') {
      if (target.tagName.toLowerCase() === 'a') target.setAttribute('href', d.value);
      else {
        var pLink = target.closest('a');
        if (pLink) pLink.setAttribute('href', d.value);
      }
    }
    else if (d.prop === 'src' && target.tagName.toLowerCase() === 'img') {
      target.setAttribute('src', d.value);
    }
    else if (d.prop === 'alt' && target.tagName.toLowerCase() === 'img') {
      target.setAttribute('alt', d.value);
    }
    else if (d.prop === 'imgWidth' && target.tagName.toLowerCase() === 'img') {
      target.setAttribute('width', d.value);
      target.style.width = d.value.indexOf('%') > -1 ? d.value : d.value + 'px';
    }
    else if (d.prop === 'imgLinkHref') {
      var imgParentLink = target.closest('a');
      if (imgParentLink) imgParentLink.setAttribute('href', d.value);
    }
    else if (d.prop === 'style') {
      for (var key in d.value) {
        target.style[key] = d.value[key];
      }
    }
    else if (d.prop === 'replaceWithImage') {
      var imgHtml = '<img src="' + d.value.src + '" width="' + (d.value.width || '220') + '" alt="' + (d.value.alt || '').replace(/"/g, '&quot;') + '" style="display:block;width:' + (d.value.width || '220') + 'px;max-width:100%;height:auto;border:0;' + (d.value.align === 'center' ? 'margin:0 auto;' : d.value.align === 'right' ? 'margin-left:auto;' : '') + '" />';
      if (d.value.linkHref) {
        imgHtml = '<a href="' + d.value.linkHref + '" target="_blank" style="text-decoration:none;">' + imgHtml + '</a>';
      }
      target.outerHTML = imgHtml;
      selected = null;
      serializeAndSend();
      return;
    }

    if (selected === target) positionOverlay(target);
    serializeAndSend();
  });

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 've-deselect') {
      selected = null;
      if (overlayEl) overlayEl.style.display = 'none';
    }
  });
})();
`;

function injectEditorScript(html: string): string {
  const scriptTag = `<script data-ve-injected>\n${EDITOR_SCRIPT}\n</script>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', scriptTag + '\n</body>');
  }
  return html + scriptTag;
}

// ---- Component ----

export function VisualEmailEditor({ html, onUpdate, expanded }: VisualEmailEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<SelectedElement | null>(null);

  // Edit fields
  const [editText, setEditText] = useState('');
  const [editHref, setEditHref] = useState('');
  const [editSrc, setEditSrc] = useState('');
  const [editAlt, setEditAlt] = useState('');
  const [editWidth, setEditWidth] = useState('');
  const [editImgLink, setEditImgLink] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editBgColor, setEditBgColor] = useState('');
  const [editFontSize, setEditFontSize] = useState('');
  const [editAlign, setEditAlign] = useState('');
  const [editRadius, setEditRadius] = useState('');

  // Replace-with-image panel state
  const [showReplacePanel, setShowReplacePanel] = useState(false);
  const [replaceImgUrl, setReplaceImgUrl] = useState('');
  const [replaceAlt, setReplaceAlt] = useState('');
  const [replaceWidth, setReplaceWidth] = useState('220');
  const [replaceAlign, setReplaceAlign] = useState('center');
  const [replaceLinkHref, setReplaceLinkHref] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showChildWarning, setShowChildWarning] = useState(false);

  const preparedHtml = injectEditorScript(html);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data) return;

      if (e.data.type === 've-select') {
        const d = e.data.data as SelectedElement;
        setSelection(d);
        setEditText(d.text);
        setEditHref(d.type === 'button' ? (d.href || d.parentLinkHref) : d.href);
        setEditSrc(d.src);
        setEditAlt(d.alt);
        setEditWidth(d.styles.width?.replace('px', '') || '');
        setEditImgLink(d.parentLinkHref);
        setEditColor(d.styles.color || '');
        setEditBgColor(d.styles.backgroundColor || '');
        setEditFontSize(d.styles.fontSize?.replace('px', '') || '');
        setEditAlign(d.styles.textAlign || 'left');
        setEditRadius(d.styles.borderRadius?.replace('px', '') || '');
        setShowReplacePanel(false);
        setShowChildWarning(false);
      }

      if (e.data.type === 've-serialized') {
        onUpdate(e.data.html);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUpdate]);

  const sendUpdate = useCallback((prop: string, value: any) => {
    if (!selection || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      type: 've-update',
      path: selection.path,
      prop,
      value,
    }, '*');
  }, [selection]);

  const applyText = () => { if (editText !== selection?.text) sendUpdate('text', editText); };
  const applyHref = () => sendUpdate('href', editHref);
  const applySrc = () => sendUpdate('src', editSrc);
  const applyAlt = () => sendUpdate('alt', editAlt);
  const applyWidth = () => sendUpdate('imgWidth', editWidth);
  const applyImgLink = () => sendUpdate('imgLinkHref', editImgLink);
  const applyStyle = (styles: Record<string, string>) => sendUpdate('style', styles);

  const deselect = () => {
    setSelection(null);
    setShowReplacePanel(false);
    setShowChildWarning(false);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 've-deselect' }, '*');
    }
  };

  const toggleStyle = (prop: string, onVal: string, offVal: string) => {
    if (!selection) return;
    const current = selection.styles[prop] || '';
    const isOn = current.includes(onVal);
    applyStyle({ [prop]: isOn ? offVal : onVal });
  };

  // ---- Replace with Image ----

  const handleOpenReplacePanel = () => {
    if (!selection) return;
    if (selection.childCount > 1) {
      setShowChildWarning(true);
    }
    setReplaceImgUrl('');
    setReplaceAlt(selection.text || '');
    setReplaceWidth('220');
    setReplaceAlign('center');
    setReplaceLinkHref('');
    setShowReplacePanel(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Please select a PNG, JPG, GIF, or WebP image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be smaller than 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `template-assets/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('marketing-images')
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('marketing-images')
        .getPublicUrl(fileName);

      setReplaceImgUrl(publicUrl);
      toast.success('Image uploaded');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const executeReplace = () => {
    if (!replaceImgUrl) {
      toast.error('Provide an image URL or upload an image first.');
      return;
    }

    sendUpdate('replaceWithImage', {
      src: replaceImgUrl,
      alt: replaceAlt,
      width: replaceWidth || '220',
      align: replaceAlign,
      linkHref: replaceLinkHref || '',
    });

    setShowReplacePanel(false);
    setShowChildWarning(false);
    setSelection(null);
    toast.success('Element replaced with image');
  };

  const cancelReplace = () => {
    setShowReplacePanel(false);
    setShowChildWarning(false);
  };

  // ---- Panels ----

  const renderReplaceImagePanel = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
        <Replace className="h-4 w-4" />
        Replace with Image
      </div>

      {showChildWarning && (
        <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>This element contains {selection?.childCount} child elements. Replacing it will remove all of them. Use Undo if needed.</span>
        </div>
      )}

      {/* Upload */}
      <div>
        <Label className="text-xs text-slate-600">Upload Image</Label>
        <div className="mt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="h-3.5 w-3.5" /> Choose File</>
            )}
          </Button>
          <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, GIF, WebP. Max 5 MB.</p>
        </div>
      </div>

      {/* URL */}
      <div>
        <Label className="text-xs text-slate-600">Or Paste Image URL</Label>
        <Input
          value={replaceImgUrl}
          onChange={(e) => setReplaceImgUrl(e.target.value)}
          className="h-8 text-sm mt-1"
          placeholder="https://example.com/logo.png"
        />
      </div>

      {/* Preview */}
      {replaceImgUrl && (
        <div className="border rounded p-2 bg-white">
          <img
            src={replaceImgUrl}
            alt="Preview"
            className="max-h-20 mx-auto"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Alt text */}
      <div>
        <Label className="text-xs text-slate-600">Alt Text</Label>
        <Input
          value={replaceAlt}
          onChange={(e) => setReplaceAlt(e.target.value)}
          className="h-8 text-sm mt-1"
          placeholder="Describe the image..."
        />
      </div>

      {/* Width and Alignment */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Width</Label>
          <div className="flex items-center gap-1 mt-1">
            <Input
              value={replaceWidth}
              onChange={(e) => setReplaceWidth(e.target.value)}
              className="h-7 text-xs"
              placeholder="220"
            />
            <span className="text-xs text-slate-400">px</span>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Alignment</Label>
          <div className="flex items-center gap-1 mt-1">
            <Button
              size="sm" variant={replaceAlign === 'left' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => setReplaceAlign('left')}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant={replaceAlign === 'center' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => setReplaceAlign('center')}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant={replaceAlign === 'right' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => setReplaceAlign('right')}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Link */}
      <div>
        <Label className="text-xs text-slate-600">Link Destination (optional)</Label>
        <Input
          value={replaceLinkHref}
          onChange={(e) => setReplaceLinkHref(e.target.value)}
          className="h-8 text-sm mt-1"
          placeholder="https://example.com"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-orange-600 hover:bg-orange-700"
          onClick={executeReplace}
          disabled={!replaceImgUrl || uploading}
        >
          <Replace className="h-3.5 w-3.5 mr-1" />
          Replace
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={cancelReplace}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderTextPanel = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-slate-600">Text Content</Label>
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={applyText}
          onKeyDown={(e) => e.key === 'Enter' && applyText()}
          className="h-8 text-sm mt-1"
        />
      </div>

      <div>
        <Label className="text-xs text-slate-600 mb-1 block">Formatting</Label>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => toggleStyle('fontWeight', 'bold', 'normal')}>
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => toggleStyle('fontStyle', 'italic', 'normal')}>
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => toggleStyle('textDecoration', 'underline', 'none')}>
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <Button size="sm" variant={editAlign === 'left' ? 'default' : 'outline'} className="h-7 w-7 p-0"
            onClick={() => { setEditAlign('left'); applyStyle({ textAlign: 'left' }); }}>
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={editAlign === 'center' ? 'default' : 'outline'} className="h-7 w-7 p-0"
            onClick={() => { setEditAlign('center'); applyStyle({ textAlign: 'center' }); }}>
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={editAlign === 'right' ? 'default' : 'outline'} className="h-7 w-7 p-0"
            onClick={() => { setEditAlign('right'); applyStyle({ textAlign: 'right' }); }}>
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Text Colour</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <input type="color" value={rgbToHex(editColor)}
              onChange={(e) => { setEditColor(e.target.value); applyStyle({ color: e.target.value }); }}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0" />
            <Input value={editColor} onChange={(e) => setEditColor(e.target.value)}
              onBlur={() => applyStyle({ color: editColor })} className="h-7 text-xs flex-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Font Size</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input value={editFontSize} onChange={(e) => setEditFontSize(e.target.value)}
              onBlur={() => applyStyle({ fontSize: editFontSize + 'px' })}
              onKeyDown={(e) => e.key === 'Enter' && applyStyle({ fontSize: editFontSize + 'px' })}
              className="h-7 text-xs" placeholder="16" />
            <span className="text-xs text-slate-400">px</span>
          </div>
        </div>
      </div>

      {/* Replace with Image button */}
      <div className="pt-2 border-t">
        <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5 text-orange-700 border-orange-200 hover:bg-orange-50"
          onClick={handleOpenReplacePanel}>
          <ImageIcon className="h-3.5 w-3.5" />
          Replace with Image
        </Button>
      </div>
    </div>
  );

  const renderButtonPanel = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-slate-600">Button Text</Label>
        <Input value={editText} onChange={(e) => setEditText(e.target.value)}
          onBlur={applyText} onKeyDown={(e) => e.key === 'Enter' && applyText()}
          className="h-8 text-sm mt-1" />
      </div>

      <div>
        <Label className="text-xs text-slate-600">Destination URL</Label>
        <Input value={editHref} onChange={(e) => setEditHref(e.target.value)}
          onBlur={applyHref} onKeyDown={(e) => e.key === 'Enter' && applyHref()}
          className="h-8 text-sm mt-1" placeholder="https://example.com" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Text Colour</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <input type="color" value={rgbToHex(editColor)}
              onChange={(e) => { setEditColor(e.target.value); applyStyle({ color: e.target.value }); }}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0" />
            <Input value={editColor} onChange={(e) => setEditColor(e.target.value)}
              onBlur={() => applyStyle({ color: editColor })} className="h-7 text-xs flex-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Background</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <input type="color" value={rgbToHex(editBgColor)}
              onChange={(e) => { setEditBgColor(e.target.value); applyStyle({ backgroundColor: e.target.value }); }}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0" />
            <Input value={editBgColor} onChange={(e) => setEditBgColor(e.target.value)}
              onBlur={() => applyStyle({ backgroundColor: editBgColor })} className="h-7 text-xs flex-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Alignment</Label>
          <div className="flex items-center gap-1 mt-1">
            <Button size="sm" variant={editAlign === 'left' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('left'); applyStyle({ textAlign: 'left' }); }}>
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={editAlign === 'center' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('center'); applyStyle({ textAlign: 'center' }); }}>
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={editAlign === 'right' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('right'); applyStyle({ textAlign: 'right' }); }}>
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Border Radius</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input value={editRadius} onChange={(e) => setEditRadius(e.target.value)}
              onBlur={() => applyStyle({ borderRadius: editRadius + 'px' })}
              onKeyDown={(e) => e.key === 'Enter' && applyStyle({ borderRadius: editRadius + 'px' })}
              className="h-7 text-xs" placeholder="4" />
            <span className="text-xs text-slate-400">px</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderImagePanel = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-slate-600">Replace Image</Label>
        <div className="mt-1 space-y-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                toast.error('Please select a PNG, JPG, GIF, or WebP image.');
                return;
              }
              if (file.size > MAX_FILE_SIZE) {
                toast.error('Image must be smaller than 5 MB.');
                return;
              }
              setUploading(true);
              try {
                const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
                const fileName = `template-assets/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
                const { error: uploadError } = await supabase.storage
                  .from('marketing-images')
                  .upload(fileName, file, { contentType: file.type, upsert: false });
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage
                  .from('marketing-images')
                  .getPublicUrl(fileName);
                setEditSrc(publicUrl);
                sendUpdate('src', publicUrl);
                toast.success('Image replaced');
              } catch (err: any) {
                toast.error('Upload failed: ' + (err.message || 'Unknown error'));
              } finally {
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }
            }}
            className="hidden"
          />
          <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</> : <><Upload className="h-3.5 w-3.5" /> Upload New Image</>}
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-slate-600">Image URL</Label>
        <Input value={editSrc} onChange={(e) => setEditSrc(e.target.value)}
          onBlur={applySrc} onKeyDown={(e) => e.key === 'Enter' && applySrc()}
          className="h-8 text-sm mt-1" placeholder="https://example.com/image.png" />
      </div>

      <div>
        <Label className="text-xs text-slate-600">Alt Text</Label>
        <Input value={editAlt} onChange={(e) => setEditAlt(e.target.value)}
          onBlur={applyAlt} onKeyDown={(e) => e.key === 'Enter' && applyAlt()}
          className="h-8 text-sm mt-1" placeholder="Describe the image..." />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Width</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input value={editWidth} onChange={(e) => setEditWidth(e.target.value)}
              onBlur={applyWidth} onKeyDown={(e) => e.key === 'Enter' && applyWidth()}
              className="h-7 text-xs" placeholder="600" />
            <span className="text-xs text-slate-400">px</span>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Alignment</Label>
          <div className="flex items-center gap-1 mt-1">
            <Button size="sm" variant={editAlign === 'left' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('left'); applyStyle({ display: 'block', marginLeft: '0', marginRight: 'auto' }); }}>
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={editAlign === 'center' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('center'); applyStyle({ display: 'block', marginLeft: 'auto', marginRight: 'auto' }); }}>
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant={editAlign === 'right' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('right'); applyStyle({ display: 'block', marginLeft: 'auto', marginRight: '0' }); }}>
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {(selection?.parentLinkHref !== undefined) && (
        <div>
          <Label className="text-xs text-slate-600">Link Destination</Label>
          <Input value={editImgLink} onChange={(e) => setEditImgLink(e.target.value)}
            onBlur={applyImgLink} onKeyDown={(e) => e.key === 'Enter' && applyImgLink()}
            className="h-8 text-sm mt-1" placeholder="https://example.com" />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-3" style={{ height: expanded ? '70vh' : '55vh', minHeight: 360 }}>
      {/* Editor iframe */}
      <div
        className="flex-1 border rounded-lg overflow-hidden bg-white relative"
        style={{ overscrollBehavior: 'contain' }}
      >
        {!selection && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-slate-800/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
            Click any element to select and edit it
          </div>
        )}
        <iframe
          ref={iframeRef}
          srcDoc={preparedHtml}
          title="Visual email editor"
          sandbox="allow-same-origin allow-scripts"
          scrolling="yes"
          className="w-full h-full border-0"
        />
      </div>

      {/* Property panel */}
      {selection && (
        <div className="w-[280px] flex-shrink-0 border rounded-lg bg-slate-50 overflow-auto">
          <div className="p-3 border-b bg-white rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selection.type === 'text' && !showReplacePanel && <Type className="h-4 w-4 text-blue-600" />}
              {selection.type === 'button' && <Link2 className="h-4 w-4 text-green-600" />}
              {(selection.type === 'image' || showReplacePanel) && <ImageIcon className="h-4 w-4 text-orange-600" />}
              <span className="text-sm font-medium capitalize">
                {showReplacePanel ? 'Replace Element' : selection.type}
              </span>
              {!showReplacePanel && (
                <span className="text-xs text-slate-400">&lt;{selection.tagName}&gt;</span>
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={deselect}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-3">
            {showReplacePanel ? (
              renderReplaceImagePanel()
            ) : (
              <>
                {selection.type === 'text' && renderTextPanel()}
                {selection.type === 'button' && renderButtonPanel()}
                {selection.type === 'image' && renderImagePanel()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Helpers ----

function rgbToHex(color: string): string {
  if (!color) return '#000000';
  if (color.startsWith('#')) {
    return color.length === 4
      ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
      : color;
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}


export { VisualEmailEditor }