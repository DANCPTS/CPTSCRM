/*
  # Update Notes Access Based on Related Entity

  This migration updates Row Level Security policies for the notes table to ensure
  notes inherit access control from their related entity:
  
  - Notes on leads: only visible to users assigned to that lead (or admins)
  - Notes on companies/candidates/bookings: visible to all authenticated users (shared entities)
  - Users can still only edit/delete their own notes

  ## Changes

  1. **Drop existing note policies**
     - Remove policies that only check created_by

  2. **Create new entity-aware policies**
     - SELECT: Users can view notes if they can access the related entity
     - INSERT: Sales and admins can create notes on any entity
     - UPDATE: Users can update their own notes (if they can access the entity)
     - DELETE: Users can delete their own notes (if they can access the entity)

  ## Security

  - Notes on leads follow lead access rules (user-specific)
  - Notes on shared entities (companies, candidates, bookings) are visible to all authenticated users
  - Users can only edit/delete notes they created
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view notes they created" ON notes;
DROP POLICY IF EXISTS "Users can create notes" ON notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;

-- Create new entity-aware policies
CREATE POLICY "Users can view notes based on entity access"
  ON notes FOR SELECT
  TO authenticated
  USING (
    -- Notes on leads: only if user is assigned to the lead or is admin
    (lead_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM leads
        WHERE leads.id = notes.lead_id
        AND (leads.assigned_to = auth.uid() OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        ))
      )
    ))
    OR
    -- Notes on companies, candidates, bookings: all authenticated users
    (company_id IS NOT NULL OR candidate_id IS NOT NULL OR booking_id IS NOT NULL)
  );

CREATE POLICY "Sales and admins can create notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      -- Can update if they can still access the entity
      (lead_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM leads
        WHERE leads.id = notes.lead_id
        AND (leads.assigned_to = auth.uid() OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        ))
      ))
      OR
      (company_id IS NOT NULL OR candidate_id IS NOT NULL OR booking_id IS NOT NULL)
    )
  )
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      -- Can delete if they can still access the entity
      (lead_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM leads
        WHERE leads.id = notes.lead_id
        AND (leads.assigned_to = auth.uid() OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        ))
      ))
      OR
      (company_id IS NOT NULL OR candidate_id IS NOT NULL OR booking_id IS NOT NULL)
    )
  );
