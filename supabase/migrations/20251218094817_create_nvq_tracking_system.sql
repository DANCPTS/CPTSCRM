/*
  # NVQ Tracking System - Complete Implementation
  
  ## Overview
  This migration creates a comprehensive NVQ (National Vocational Qualification) tracking 
  system to manage upsell opportunities for Blue Card conversions from CPCS and NPORS courses.
  
  ## Business Context
  - CPCS card holders ALWAYS need NVQ Level 2 to convert Red Card to Blue Card
  - NPORS card holders ONLY need NVQ if they want the CSCS logo on their card
  - The initial follow-up reminder is set to 3 months after the candidate passes their course
  - Red Card expiry dates are captured when marking candidates as passed
  
  ## New Tables
  
  ### 1. nvq_tracking
  Tracks each candidate's NVQ eligibility and follow-up status:
    - `id` (uuid, primary key)
    - `candidate_id` (uuid, FK to candidates) - The candidate requiring NVQ
    - `source_candidate_course_id` (uuid, FK to candidate_courses) - Original CPCS/NPORS course
    - `accreditation_type` (text) - CPCS or NPORS
    - `requires_nvq` (boolean) - Whether this candidate needs NVQ
    - `red_card_expiry_date` (date) - When their temporary card expires
    - `nvq_status` (text) - Current status in the NVQ pipeline
    - `nvq_reminder_date` (date) - Next reminder date (initially 3 months after passing)
    - `last_contacted_date` (date) - Most recent contact attempt
    - `notes` (text) - General notes about this tracking record
    - `created_at`, `updated_at` (timestamps)
    - `created_by` (uuid, FK to users)
  
  ### 2. nvq_contact_logs
  Logs each contact attempt for NVQ follow-ups:
    - `id` (uuid, primary key)
    - `nvq_tracking_id` (uuid, FK to nvq_tracking)
    - `contact_method` (text) - phone, email, in_person
    - `outcome` (text) - reached, no_answer, voicemail, etc.
    - `notes` (text) - Details of the conversation
    - `follow_up_date` (date) - Suggested next follow-up
    - `created_at` (timestamp)
    - `created_by` (uuid, FK to users)
  
  ## Schema Changes
  
  ### candidate_courses table
  - Add `requires_nvq_for_blue_card` (boolean) - Flag set at booking time
  
  ## Security
  - RLS enabled on all new tables
  - Authenticated users can view, create, update NVQ tracking records
  - Contact logs follow same access pattern
  
  ## Indexes
  - nvq_reminder_date for efficient date-based queries
  - nvq_status for filtering by status
  - candidate_id for lookups by candidate
*/

-- Create nvq_tracking table
CREATE TABLE IF NOT EXISTS nvq_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  source_candidate_course_id uuid REFERENCES candidate_courses(id) ON DELETE SET NULL,
  accreditation_type text NOT NULL CHECK (accreditation_type IN ('CPCS', 'NPORS')),
  requires_nvq boolean NOT NULL DEFAULT true,
  red_card_expiry_date date,
  nvq_status text NOT NULL DEFAULT 'eligible' CHECK (nvq_status IN ('eligible', 'contacted', 'interested', 'in_progress', 'enrolled', 'completed', 'declined', 'not_required')),
  nvq_reminder_date date NOT NULL,
  last_contacted_date date,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create nvq_contact_logs table
CREATE TABLE IF NOT EXISTS nvq_contact_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nvq_tracking_id uuid NOT NULL REFERENCES nvq_tracking(id) ON DELETE CASCADE,
  contact_method text NOT NULL CHECK (contact_method IN ('phone', 'email', 'in_person', 'sms', 'other')),
  outcome text NOT NULL CHECK (outcome IN ('reached', 'no_answer', 'voicemail', 'wrong_number', 'callback_requested', 'interested', 'not_interested', 'enrolled', 'other')),
  notes text,
  follow_up_date date,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add requires_nvq_for_blue_card to candidate_courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'candidate_courses' 
    AND column_name = 'requires_nvq_for_blue_card'
  ) THEN
    ALTER TABLE candidate_courses 
      ADD COLUMN requires_nvq_for_blue_card boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nvq_tracking_candidate_id ON nvq_tracking(candidate_id);
CREATE INDEX IF NOT EXISTS idx_nvq_tracking_reminder_date ON nvq_tracking(nvq_reminder_date);
CREATE INDEX IF NOT EXISTS idx_nvq_tracking_status ON nvq_tracking(nvq_status);
CREATE INDEX IF NOT EXISTS idx_nvq_tracking_source_course ON nvq_tracking(source_candidate_course_id);
CREATE INDEX IF NOT EXISTS idx_nvq_contact_logs_tracking_id ON nvq_contact_logs(nvq_tracking_id);
CREATE INDEX IF NOT EXISTS idx_nvq_contact_logs_created_at ON nvq_contact_logs(created_at DESC);

-- Enable RLS
ALTER TABLE nvq_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE nvq_contact_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nvq_tracking
CREATE POLICY "Authenticated users can view all NVQ tracking"
  ON nvq_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create NVQ tracking"
  ON nvq_tracking FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update NVQ tracking"
  ON nvq_tracking FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete NVQ tracking"
  ON nvq_tracking FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for nvq_contact_logs
CREATE POLICY "Authenticated users can view all NVQ contact logs"
  ON nvq_contact_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create NVQ contact logs"
  ON nvq_contact_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update NVQ contact logs"
  ON nvq_contact_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete NVQ contact logs"
  ON nvq_contact_logs FOR DELETE
  TO authenticated
  USING (true);

-- Function to update updated_at timestamp for nvq_tracking
CREATE OR REPLACE FUNCTION update_nvq_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_nvq_tracking_updated_at ON nvq_tracking;
CREATE TRIGGER trigger_update_nvq_tracking_updated_at
  BEFORE UPDATE ON nvq_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_nvq_tracking_updated_at();
