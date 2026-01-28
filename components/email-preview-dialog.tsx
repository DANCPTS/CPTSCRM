'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const [editedHtml, setEditedHtml] = useState(htmlContent);
  const [editedSubject, setEditedSubject] = useState(subject);

  useEffect(() => {
    setEditedHtml(htmlContent);
    setEditedSubject(subject);
    setIsEditing(false);
  }, [htmlContent, subject, open]);

  const handleReset = () => {
    setEditedHtml(htmlContent);
    setEditedSubject(subject);
  };

  const hasChanges = editedHtml !== htmlContent || editedSubject !== subject;

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

        {isEditing ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <Textarea
              value={editedHtml}
              onChange={(e) => setEditedHtml(e.target.value)}
              className="w-full h-full min-h-[400px] font-mono text-xs resize-none"
              placeholder="Edit HTML content..."
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-white">
            <iframe
              srcDoc={editedHtml}
              className="w-full h-full min-h-[400px]"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}

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
                  Preview
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit HTML
                </>
              )}
            </Button>
            <Button onClick={() => onSend(editedHtml, editedSubject)} disabled={isSending}>
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
