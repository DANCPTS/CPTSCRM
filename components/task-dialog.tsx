'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any;
  onTaskUpdated: () => void;
}

export function TaskDialog({ open, onOpenChange, task, onTaskUpdated }: TaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    status: 'open',
    due_date: '',
  });
  const [relatedEntity, setRelatedEntity] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        status: task.status || 'open',
        due_date: task.due_date || '',
      });

      if (task.related_to_type && task.related_to_id) {
        loadRelatedEntity(task.related_to_type, task.related_to_id);
      }

      loadNotes();
    }
  }, [task]);

  const loadNotes = async () => {
    if (!task?.id) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*, users(full_name)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const loadRelatedEntity = async (type: string, id: string) => {
    try {
      const tableName = type === 'lead' ? 'leads' :
                       type === 'company' ? 'companies' :
                       type === 'candidate' ? 'candidates' :
                       type === 'booking' ? 'bookings' : null;

      if (!tableName) return;

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setRelatedEntity({ type, data });
    } catch (error) {
      console.error('Failed to load related entity:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          status: formData.status,
          due_date: formData.due_date || null,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast.success('Task updated successfully');
      onTaskUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to update task');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast.success('Task deleted');
      onTaskUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to delete task');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notes')
        .insert({
          content: newNote,
          note_type: 'note',
          task_id: task.id,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Note added');
      setNewNote('');
      loadNotes();
    } catch (error: any) {
      toast.error('Failed to add note');
      console.error(error);
    }
  };

  const getEntityDisplayName = () => {
    if (!relatedEntity) return null;

    const { type, data } = relatedEntity;
    if (type === 'lead') return data.name;
    if (type === 'company') return data.name;
    if (type === 'candidate') return data.name;
    if (type === 'booking') return `Booking #${data.id?.substring(0, 8)}`;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          {relatedEntity && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <Label className="text-sm text-slate-600">Related To</Label>
              <p className="font-semibold capitalize">
                {relatedEntity.type}: {getEntityDisplayName()}
              </p>
            </div>
          )}

          {task?.created_at && (
            <div className="text-sm text-slate-600">
              Created {format(parseISO(task.created_at), 'MMM d, yyyy h:mm a')}
            </div>
          )}

          <div className="border-t pt-4 mt-4">
            <Label className="text-sm font-semibold mb-2 block">Notes</Label>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No notes yet</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="text-xs text-slate-500 mt-2">
                      {note.users?.full_name} • {format(parseISO(note.created_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddNote}
                disabled={!newNote.trim()}
              >
                Add Note
              </Button>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete Task
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
