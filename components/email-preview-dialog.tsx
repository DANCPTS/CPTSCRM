'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Mail, Send, Pencil, X, Loader2, Eye, RotateCcw } from 'lucide-react';

interface EmailPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  onSend: (modifiedHtml: string, modifiedSubject: string) => void;
  isSending?: boolean;
  emailType: 'booking-form' | 'joining-instructions';
}

export function EmailPreviewDialog({
  open,
  onClose,
  recipientEmail,
  subject,
  htmlContent,
  onSend,
  isSending = false,
  emailType,
}: EmailPreviewDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(subject);
  const [hasContentChanges, setHasContentChanges] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const originalHtmlRef = useRef(htmlContent);

  useEffect(() => {
    setEditedSubject(subject);
    setIsEditing(false);
    setHasContentChanges(false);
    originalHtmlRef.current = htmlContent;
  }, [htmlContent, subject, open]);

  useEffect(() => {
    if (iframeRef.current && isEditing) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.body.contentEditable = 'true';
        doc.body.style.cursor = 'text';
        doc.body.style.outline = 'none';

        const handleInput = () => {
          setHasContentChanges(true);
        };
        doc.body.addEventListener('input', handleInput);

        return () => {
          doc.body.removeEventListener('input', handleInput);
        };
      }
    } else if (iframeRef.current && !isEditing) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.body.contentEditable = 'false';
        doc.body.style.cursor = 'default';
      }
    }
  }, [isEditing]);

  const getEditedHtml = () => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        return `<!DOCTYPE html><html><head>${doc.head.innerHTML}</head><body>${doc.body.innerHTML}</body></html>`;
      }
    }
    return htmlContent;
  };

  const handleReset = () => {
    setEditedSubject(subject);
    setHasContentChanges(false);
    if (iframeRef.current) {
      iframeRef.current.srcdoc = originalHtmlRef.current;
    }
  };

  const handleSend = () => {
    const finalHtml = getEditedHtml();
    onSend(finalHtml, editedSubject);
  };

  const hasChanges = hasContentChanges || editedSubject !== subject;

  const editableHtml = htmlContent.replace(
    '<body>',
    '<body style="outline: none;">'
  );

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {isEditing ? 'Edit Email' : 'Email Preview'}
            {hasChanges && (
              <Badge variant="secondary" className="ml-2 text-xs">Modified</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-shrink-0 space-y-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 w-16">To:</span>
            <Badge variant="secondary" className="text-sm font-mono">
              {recipientEmail}
            </Badge>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-sm font-medium text-slate-600 w-16">Subject:</span>
            {isEditing ? (
              <Input
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="flex-1 text-sm"
              />
            ) : (
              <span className="text-sm text-slate-900">{editedSubject}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 w-16">Type:</span>
            <Badge variant="outline" className="text-xs">
              {emailType === 'booking-form' ? 'Booking Form / Quote' : 'Joining Instructions'}
            </Badge>
          </div>
        </div>

        <div className={`flex-1 min-h-0 overflow-hidden rounded-lg border bg-white ${isEditing ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
          {isEditing && (
            <div className="bg-blue-50 border-b border-blue-200 px-3 py-2 text-sm text-blue-700">
              Click on any text below to edit it directly
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={editableHtml}
            className="w-full h-full min-h-[400px]"
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        </div>

        <DialogFooter className="flex-shrink-0 flex gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
            {hasChanges && (
              <Button variant="ghost" onClick={handleReset} disabled={isSending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
              disabled={isSending}
            >
              {isEditing ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Done Editing
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Now
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
