/*
  # Create notifications table

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users) - who should see this notification
      - `type` (text) - type of notification (e.g., 'booking_form_signed')
      - `title` (text) - notification title
      - `message` (text) - notification message
      - `reference_id` (uuid) - reference to related record (e.g., booking_form id)
      - `reference_type` (text) - type of reference (e.g., 'booking_form', 'lead')
      - `read` (boolean) - whether notification has been read
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `notifications` table
    - Users can only view their own notifications
    - Users can update their own notifications (mark as read)
    - System can create notifications (handled via trigger)

  3. Indexes
    - Add index on user_id for fast lookups
    - Add index on read status for filtering
    - Add index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid,
  reference_type text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can insert notifications (for triggers)
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_id, reference_type);
