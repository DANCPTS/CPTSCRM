'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Pencil, X, Loader2 } from 'lucide-react';

interface EmailPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  onEdit: () => void;
  onSend: () => void;
  isSending?: boolean;
  emailType: 'booking-form' | 'joining-instructions';
}

export function EmailPreviewDialog({
  open,
  onClose,
  recipientEmail,
  subject,
  htmlContent,
  onEdit,
  onSend,
  isSending = false,
  emailType,
}: EmailPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview
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
            <span className="text-sm text-slate-900">{subject}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 w-16">Type:</span>
            <Badge variant="outline" className="text-xs">
              {emailType === 'booking-form' ? 'Booking Form / Quote' : 'Joining Instructions'}
            </Badge>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-white">
          <iframe
            srcDoc={htmlContent}
            className="w-full h-full min-h-[400px]"
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        </div>

        <DialogFooter className="flex-shrink-0 flex gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEdit} disabled={isSending}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button onClick={onSend} disabled={isSending}>
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
