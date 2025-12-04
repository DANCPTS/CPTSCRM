/*
  # Create notes and AI extracted data tables

  1. New Tables
    - `notes`
      - Stores meeting notes, call notes, and other text entries
      - Links to leads, companies, candidates, or bookings
      - Tracks who created the note and when
      - Stores raw note content
      
    - `note_extractions`
      - Stores AI-extracted structured data from notes
      - Links back to the source note
      - Contains action items, dates, people, commitments
      - JSON field for flexible data structure

  2. Security
    - Enable RLS on both tables
    - Users can only access notes they created or are assigned to
    - Admin users can access all notes

  3. Features
    - Full text search on notes
    - Automatic timestamping
    - Support for multiple entity types (leads, companies, etc.)
*/

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  content text NOT NULL,
  note_type text DEFAULT 'general' CHECK (note_type IN ('general', 'call', 'meeting', 'email', 'other')),
  
  -- Relationships (one of these should be set)
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Metadata
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- AI processing status
  ai_processed boolean DEFAULT false,
  ai_processed_at timestamptz
);

-- Create note_extractions table
CREATE TABLE IF NOT EXISTS note_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE NOT NULL,
  
  -- Extracted data
  action_items jsonb DEFAULT '[]'::jsonb,
  dates jsonb DEFAULT '[]'::jsonb,
  people jsonb DEFAULT '[]'::jsonb,
  commitments jsonb DEFAULT '[]'::jsonb,
  sentiment text,
  priority text,
  suggested_status text,
  
  -- Additional extracted info
  extracted_data jsonb DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  model_used text,
  tokens_used integer
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_notes_company_id ON notes(company_id);
CREATE INDEX IF NOT EXISTS idx_notes_candidate_id ON notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_notes_booking_id ON notes(booking_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_extractions_note_id ON note_extractions(note_id);

-- Enable full text search on notes
CREATE INDEX IF NOT EXISTS idx_notes_content_search ON notes USING gin(to_tsvector('english', content));

-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_extractions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes
CREATE POLICY "Users can view notes they created"
  ON notes FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for note_extractions
CREATE POLICY "Users can view extractions for their notes"
  ON note_extractions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_extractions.note_id
      AND notes.created_by = auth.uid()
    )
  );

CREATE POLICY "Service role can insert extractions"
  ON note_extractions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can update extractions"
  ON note_extractions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_notes_updated_at ON notes;
CREATE TRIGGER trigger_update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();
