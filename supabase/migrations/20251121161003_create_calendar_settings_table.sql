/*
  # Create calendar settings table

  1. New Tables
    - `calendar_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users.id)
      - `category` (text) - e.g., 'training', 'test', 'assessment', etc.
      - `color` (text) - color value (blue, green, red, etc.)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `calendar_settings` table
    - Add policies for users to manage their own settings
*/

CREATE TABLE IF NOT EXISTS calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category)
);

ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar settings"
  ON calendar_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar settings"
  ON calendar_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar settings"
  ON calendar_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar settings"
  ON calendar_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);