'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type, Link2, Image as ImageIcon, Palette, X } from 'lucide-react';

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
}

interface VisualEmailEditorProps {
  html: string;
  onUpdate: (html: string) => void;
  expanded?: boolean;
}

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
    // Skip the overlay itself
    if (el.id === '__ve_overlay') return null;
    // For inline elements inside a larger block, prefer the inline if it has text
    if (el.matches && el.matches(SELECTABLE)) {
      // For table cells, only select if they have direct text content
      if ((tag === 'td' || tag === 'th') && el.querySelector('h1,h2,h3,h4,h5,h6,p,a,img,span')) {
        return null; // Let child be selected instead
      }
      return el;
    }
    return getClosestEditable(el.parentElement);
  }

  function classify(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'img') return 'image';
    if (tag === 'a' || tag === 'button') return 'button';
    // Check if it's inside a link (button-like)
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
    };

    window.parent.postMessage({ type: 've-select', data: data }, '*');
  }, true);

  // Prevent all navigation
  document.addEventListener('click', function(e) { e.preventDefault(); }, false);
  var allLinks = document.querySelectorAll('a');
  allLinks.forEach(function(a) { a.addEventListener('click', function(e) { e.preventDefault(); }); });

  // Listen for update commands from the parent
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 've-update') return;
    var d = e.data;
    var target = null;

    if (d.path && d.path.length) {
      target = document.documentElement;
      for (var i = 0; i < d.path.length; i++) {
        if (!target || !target.children[d.path[i]]) { target = null; break; }
        target = target.children[d.path[i]];
      }
    }

    if (!target) return;

    if (d.prop === 'text' && target.tagName.toLowerCase() !== 'img') {
      // For elements with children, update textContent of the first text node or the element itself
      var firstText = null;
      for (var c = 0; c < target.childNodes.length; c++) {
        if (target.childNodes[c].nodeType === 3 && target.childNodes[c].textContent.trim()) {
          firstText = target.childNodes[c]; break;
        }
      }
      if (firstText) firstText.textContent = d.value;
      else if (!target.children.length) target.textContent = d.value;
      else {
        // Has child elements — set text of the deepest text-only node
        var deepest = target;
        while (deepest.children.length === 1 && !deepest.children[0].matches('img')) {
          deepest = deepest.children[0];
        }
        if (!deepest.children.length) deepest.textContent = d.value;
        else {
          // Find first text node in subtree
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

    // Reposition overlay
    if (selected === target) positionOverlay(target);

    // Send back the serialized document
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

    // Re-inject ourselves
    selected = null;
  });

  // Deselect
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 've-deselect') {
      selected = null;
      if (overlayEl) overlayEl.style.display = 'none';
    }
  });
})();
`;

function injectEditorScript(html: string): string {
  const scriptTag = `<script data-ve-injected>
${EDITOR_SCRIPT}
</script>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', scriptTag + '\n</body>');
  }
  return html + scriptTag;
}

// ---- Component ----

export function VisualEmailEditor({ html, onUpdate, expanded }: VisualEmailEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selection, setSelection] = useState<SelectedElement | null>(null);
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

  const preparedHtml = injectEditorScript(html);

  // Listen for messages from the iframe
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
      }

      if (e.data.type === 've-serialized') {
        onUpdate(e.data.html);
        // Re-render the iframe with the updated html will happen via the parent
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
          <Button
            size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => toggleStyle('fontWeight', 'bold', 'normal')}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => toggleStyle('fontStyle', 'italic', 'normal')}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm" variant="outline" className="h-7 w-7 p-0"
            onClick={() => toggleStyle('textDecoration', 'underline', 'none')}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <Button
            size="sm" variant={editAlign === 'left' ? 'default' : 'outline'} className="h-7 w-7 p-0"
            onClick={() => { setEditAlign('left'); applyStyle({ textAlign: 'left' }); }}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm" variant={editAlign === 'center' ? 'default' : 'outline'} className="h-7 w-7 p-0"
            onClick={() => { setEditAlign('center'); applyStyle({ textAlign: 'center' }); }}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm" variant={editAlign === 'right' ? 'default' : 'outline'} className="h-7 w-7 p-0"
            onClick={() => { setEditAlign('right'); applyStyle({ textAlign: 'right' }); }}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Text Colour</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="color"
              value={rgbToHex(editColor)}
              onChange={(e) => { setEditColor(e.target.value); applyStyle({ color: e.target.value }); }}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
            />
            <Input
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              onBlur={() => applyStyle({ color: editColor })}
              className="h-7 text-xs flex-1"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Font Size</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input
              value={editFontSize}
              onChange={(e) => setEditFontSize(e.target.value)}
              onBlur={() => applyStyle({ fontSize: editFontSize + 'px' })}
              onKeyDown={(e) => e.key === 'Enter' && applyStyle({ fontSize: editFontSize + 'px' })}
              className="h-7 text-xs"
              placeholder="16"
            />
            <span className="text-xs text-slate-400">px</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderButtonPanel = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-slate-600">Button Text</Label>
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={applyText}
          onKeyDown={(e) => e.key === 'Enter' && applyText()}
          className="h-8 text-sm mt-1"
        />
      </div>

      <div>
        <Label className="text-xs text-slate-600">Destination URL</Label>
        <Input
          value={editHref}
          onChange={(e) => setEditHref(e.target.value)}
          onBlur={applyHref}
          onKeyDown={(e) => e.key === 'Enter' && applyHref()}
          className="h-8 text-sm mt-1"
          placeholder="https://example.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Text Colour</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="color"
              value={rgbToHex(editColor)}
              onChange={(e) => { setEditColor(e.target.value); applyStyle({ color: e.target.value }); }}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
            />
            <Input
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              onBlur={() => applyStyle({ color: editColor })}
              className="h-7 text-xs flex-1"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Background</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="color"
              value={rgbToHex(editBgColor)}
              onChange={(e) => { setEditBgColor(e.target.value); applyStyle({ backgroundColor: e.target.value }); }}
              className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0"
            />
            <Input
              value={editBgColor}
              onChange={(e) => setEditBgColor(e.target.value)}
              onBlur={() => applyStyle({ backgroundColor: editBgColor })}
              className="h-7 text-xs flex-1"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Alignment</Label>
          <div className="flex items-center gap-1 mt-1">
            <Button
              size="sm" variant={editAlign === 'left' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('left'); applyStyle({ textAlign: 'left' }); }}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant={editAlign === 'center' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('center'); applyStyle({ textAlign: 'center' }); }}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant={editAlign === 'right' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('right'); applyStyle({ textAlign: 'right' }); }}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Border Radius</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input
              value={editRadius}
              onChange={(e) => setEditRadius(e.target.value)}
              onBlur={() => applyStyle({ borderRadius: editRadius + 'px' })}
              onKeyDown={(e) => e.key === 'Enter' && applyStyle({ borderRadius: editRadius + 'px' })}
              className="h-7 text-xs"
              placeholder="4"
            />
            <span className="text-xs text-slate-400">px</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderImagePanel = () => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-slate-600">Image URL (Replace Image)</Label>
        <Input
          value={editSrc}
          onChange={(e) => setEditSrc(e.target.value)}
          onBlur={applySrc}
          onKeyDown={(e) => e.key === 'Enter' && applySrc()}
          className="h-8 text-sm mt-1"
          placeholder="https://example.com/image.png"
        />
      </div>

      <div>
        <Label className="text-xs text-slate-600">Alt Text</Label>
        <Input
          value={editAlt}
          onChange={(e) => setEditAlt(e.target.value)}
          onBlur={applyAlt}
          onKeyDown={(e) => e.key === 'Enter' && applyAlt()}
          className="h-8 text-sm mt-1"
          placeholder="Describe the image..."
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-slate-600">Width</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <Input
              value={editWidth}
              onChange={(e) => setEditWidth(e.target.value)}
              onBlur={applyWidth}
              onKeyDown={(e) => e.key === 'Enter' && applyWidth()}
              className="h-7 text-xs"
              placeholder="600"
            />
            <span className="text-xs text-slate-400">px</span>
          </div>
        </div>
        <div>
          <Label className="text-xs text-slate-600">Alignment</Label>
          <div className="flex items-center gap-1 mt-1">
            <Button
              size="sm" variant={editAlign === 'left' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('left'); applyStyle({ display: 'block', marginLeft: '0', marginRight: 'auto' }); }}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant={editAlign === 'center' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('center'); applyStyle({ display: 'block', marginLeft: 'auto', marginRight: 'auto' }); }}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant={editAlign === 'right' ? 'default' : 'outline'} className="h-7 w-7 p-0"
              onClick={() => { setEditAlign('right'); applyStyle({ display: 'block', marginLeft: 'auto', marginRight: '0' }); }}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {(selection?.parentLinkHref !== undefined) && (
        <div>
          <Label className="text-xs text-slate-600">Link Destination</Label>
          <Input
            value={editImgLink}
            onChange={(e) => setEditImgLink(e.target.value)}
            onBlur={applyImgLink}
            onKeyDown={(e) => e.key === 'Enter' && applyImgLink()}
            className="h-8 text-sm mt-1"
            placeholder="https://example.com"
          />
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
              {selection.type === 'text' && <Type className="h-4 w-4 text-blue-600" />}
              {selection.type === 'button' && <Link2 className="h-4 w-4 text-green-600" />}
              {selection.type === 'image' && <ImageIcon className="h-4 w-4 text-orange-600" />}
              <span className="text-sm font-medium capitalize">{selection.type}</span>
              <span className="text-xs text-slate-400">&lt;{selection.tagName}&gt;</span>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={deselect}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-3">
            {selection.type === 'text' && renderTextPanel()}
            {selection.type === 'button' && renderButtonPanel()}
            {selection.type === 'image' && renderImagePanel()}
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
