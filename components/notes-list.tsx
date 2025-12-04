"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, User, ListChecks, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

interface Note {
  id: string;
  content: string;
  note_type: string;
  created_at: string;
  ai_processed: boolean;
  created_by: string;
  users?: {
    email: string;
  };
}

interface NoteExtraction {
  id: string;
  note_id: string;
  action_items: any[];
  dates: any[];
  people: any[];
  sentiment: string;
  priority: string;
}

interface NotesListProps {
  entityType: 'lead' | 'company' | 'candidate' | 'booking';
  entityId: string;
  refreshTrigger?: number;
  onNoteDeleted?: () => void;
}

export function NotesList({ entityType, entityId, refreshTrigger, onNoteDeleted }: NotesListProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [extractions, setExtractions] = useState<Record<string, NoteExtraction>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [entityType, entityId, refreshTrigger]);

  const loadNotes = async () => {
    try {
      console.log('Loading notes for', entityType, entityId);
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select(`
          *,
          users:created_by (email)
        `)
        .eq(`${entityType}_id`, entityId)
        .order('created_at', { ascending: false });

      console.log('Notes loaded:', notesData?.length, 'notes');

      if (notesError) throw notesError;

      setNotes(notesData || []);

      const processedNoteIds = notesData?.filter(n => n.ai_processed).map(n => n.id) || [];

      if (processedNoteIds.length > 0) {
        const { data: extractionsData, error: extractionsError } = await supabase
          .from('note_extractions')
          .select('*')
          .in('note_id', processedNoteIds);

        if (!extractionsError && extractionsData) {
          const extractionsMap = extractionsData.reduce((acc, ext) => {
            acc[ext.note_id] = ext;
            return acc;
          }, {} as Record<string, NoteExtraction>);
          setExtractions(extractionsMap);
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleDeleteClick = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    console.log('handleDelete called with noteToDelete:', noteToDelete);
    if (!noteToDelete) {
      console.log('No note to delete, returning');
      return;
    }

    setIsDeleting(true);
    console.log('Starting delete for note:', noteToDelete);
    try {
      const { data, error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteToDelete);

      console.log('Delete result:', { data, error, noteToDelete });

      if (error) throw error;

      console.log('Delete successful, closing dialog');
      setDeleteDialogOpen(false);
      setNoteToDelete(null);

      console.log('Reloading notes after delete');
      await loadNotes();
      onNoteDeleted?.();

      toast.success('Note deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete note');
      console.error('Error deleting note:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading notes...</div>;
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No notes yet. Add a note to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => {
        const extraction = extractions[note.id];
        const isExpanded = expandedNotes.has(note.id);

        return (
          <Card key={note.id} className="p-4 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0"
              onClick={() => handleDeleteClick(note.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>

            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap pr-8">
                  <Badge variant="outline">{note.note_type}</Badge>
                  {note.ai_processed && (
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI Processed
                    </Badge>
                  )}
                  {extraction && (
                    <>
                      {extraction.action_items?.length > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <ListChecks className="h-3 w-3" />
                          {extraction.action_items.length} tasks
                        </Badge>
                      )}
                      <Badge variant="outline">{extraction.sentiment}</Badge>
                      <Badge variant="outline">{extraction.priority} priority</Badge>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>

                <div className="text-sm whitespace-pre-wrap">
                  {isExpanded ? note.content : note.content.substring(0, 200) + (note.content.length > 200 ? '...' : '')}
                </div>

                {note.content.length > 200 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => toggleExpanded(note.id)}
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </Button>
                )}

                {extraction && isExpanded && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    {extraction.action_items && extraction.action_items.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <ListChecks className="h-3 w-3" />
                          Action Items
                        </h5>
                        <ul className="space-y-1 text-sm">
                          {extraction.action_items.map((item: any, idx: number) => (
                            <li key={idx} className="flex gap-2">
                              <span>•</span>
                              <span>{item.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {extraction.dates && extraction.dates.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Dates
                        </h5>
                        <ul className="space-y-1 text-sm">
                          {extraction.dates.map((item: any, idx: number) => (
                            <li key={idx}>
                              <span className="font-medium">{item.date}</span>
                              {item.context && ` - ${item.context}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {extraction.people && extraction.people.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          People
                        </h5>
                        <ul className="space-y-1 text-sm">
                          {extraction.people.map((item: any, idx: number) => (
                            <li key={idx}>
                              <span className="font-medium">{item.name}</span>
                              {item.role && ` (${item.role})`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {note.users?.email || 'Unknown user'}
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!isDeleting) {
          setDeleteDialogOpen(open);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
              {noteToDelete && extractions[noteToDelete] && (
                <span className="block mt-2 text-amber-600">
                  This note has AI-extracted data that will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={(e) => {
                console.log('Delete button clicked!', { noteToDelete, isDeleting });
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isDeleting}
              className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
