"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'lead' | 'company' | 'candidate' | 'booking';
  entityId: string;
  entityName?: string;
  onNoteAdded?: () => void;
}

export function NotesDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  onNoteAdded
}: NotesDialogProps) {
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);

  const handleSubmit = async (processWithAI: boolean = false) => {
    if (!content.trim()) {
      toast.error("Please enter some notes");
      return;
    }

    setIsProcessing(true);
    setAiResults(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const noteData: any = {
        content: content.trim(),
        note_type: noteType,
        created_by: user.id,
        [`${entityType}_id`]: entityId,
      };

      const { data: note, error: noteError } = await supabase
        .from('notes')
        .insert(noteData)
        .select()
        .single();

      if (noteError) throw noteError;

      if (processWithAI) {
        const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-note-with-ai`;
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            noteId: note.id,
            content: content.trim(),
            entityType,
            entityId,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI processing error:', errorText);
          let errorMessage = 'Failed to process note with AI';

          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorMessage = errorJson.error;
            }
          } catch (e) {
            if (errorText) {
              errorMessage = errorText;
            }
          }

          throw new Error(errorMessage);
        }

        const result = await response.json();
        setAiResults(result.extraction);

        toast.success(`Note saved! AI found ${result.extraction.action_items?.length || 0} action items and created ${result.tasks_created} tasks`, {
          icon: <Sparkles className="h-4 w-4" />,
        });
      } else {
        toast.success("Note saved successfully");
      }

      setContent("");
      onNoteAdded?.();

      if (!processWithAI) {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast.error(error.message || "Failed to save note");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setContent("");
    setAiResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Add Note {entityName && `- ${entityName}`}
          </DialogTitle>
        </DialogHeader>

        {!aiResults ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-type">Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger id="note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="note-content">Notes</Label>
              <Textarea
                id="note-content"
                placeholder="Paste your meeting notes or call summary here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground mt-1">
                AI can extract action items, dates, and commitments from your notes
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Only'
                )}
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Save & Process with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Note processed successfully!</span>
            </div>

            {aiResults.extracted_data?.summary && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm">{aiResults.extracted_data.summary}</p>
              </div>
            )}

            {aiResults.action_items && aiResults.action_items.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium mb-2">Action Items ({aiResults.action_items.length})</h4>
                <ul className="space-y-2">
                  {aiResults.action_items.map((item: any, idx: number) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <div className="flex-1">
                        <div>{item.description}</div>
                        {item.assignee && (
                          <div className="text-xs text-muted-foreground">
                            Assignee: {item.assignee}
                          </div>
                        )}
                        {item.due_date && (
                          <div className="text-xs text-muted-foreground">
                            Due: {item.due_date}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiResults.dates && aiResults.dates.length > 0 && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-medium mb-2">Important Dates</h4>
                <ul className="space-y-1">
                  {aiResults.dates.map((item: any, idx: number) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{item.date}</span>
                      {item.context && ` - ${item.context}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiResults.people && aiResults.people.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium mb-2">People Mentioned</h4>
                <ul className="space-y-1">
                  {aiResults.people.map((item: any, idx: number) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{item.name}</span>
                      {item.role && ` (${item.role})`}
                      {item.context && ` - ${item.context}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiResults.commitments && aiResults.commitments.length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="font-medium mb-2">Commitments</h4>
                <ul className="space-y-1">
                  {aiResults.commitments.map((item: any, idx: number) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{item.party}:</span> {item.commitment}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 text-sm text-muted-foreground">
              <div>Sentiment: <span className="font-medium">{aiResults.sentiment}</span></div>
              <div>•</div>
              <div>Priority: <span className="font-medium">{aiResults.priority}</span></div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
