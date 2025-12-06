/*
  # Make created_by Columns Nullable and Cleanup Orphaned Data

  1. Purpose
    - Make created_by and other user reference columns nullable where appropriate
    - Remove orphaned references that would violate foreign key constraints
  
  2. Changes
    - Make created_by columns nullable in various tables
    - Set orphaned references to NULL
*/

-- Make created_by nullable in tables where it's currently NOT NULL
ALTER TABLE candidate_courses ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE email_templates ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE marketing_campaigns ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE notes ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE trainers ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE training_sessions ALTER COLUMN created_by DROP NOT NULL;

-- Clean up orphaned candidate_ids in bookings
UPDATE bookings
SET candidate_id = NULL
WHERE candidate_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM candidates WHERE candidates.id = bookings.candidate_id);

-- Clean up orphaned company_ids in bookings
UPDATE bookings
SET company_id = NULL
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies WHERE companies.id = bookings.company_id);

-- Clean up orphaned contact_ids in bookings
UPDATE bookings
SET contact_id = NULL
WHERE contact_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM contacts WHERE contacts.id = bookings.contact_id);

-- Clean up orphaned company_ids in contacts
UPDATE contacts
SET company_id = NULL
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies WHERE companies.id = contacts.company_id);

-- Clean up orphaned company_ids in leads
UPDATE leads
SET company_id = NULL
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies WHERE companies.id = leads.company_id);

-- Clean up orphaned created_by in various tables
UPDATE candidate_courses
SET created_by = NULL
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = candidate_courses.created_by);

UPDATE email_templates
SET created_by = NULL
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = email_templates.created_by);

UPDATE marketing_campaigns
SET created_by = NULL
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = marketing_campaigns.created_by);

UPDATE notes
SET created_by = NULL
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = notes.created_by);

UPDATE trainers
SET created_by = NULL
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = trainers.created_by);

UPDATE trainers
SET user_id = NULL
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = trainers.user_id);

UPDATE training_sessions
SET created_by = NULL
WHERE created_by IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = training_sessions.created_by);

UPDATE training_sessions
SET trainer_id = NULL
WHERE trainer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainers.id = training_sessions.trainer_id);

-- Clean up orphaned trainer_ids in course_runs
UPDATE course_runs
SET trainer_id = NULL
WHERE trainer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainers.id = course_runs.trainer_id);

UPDATE course_runs
SET tester_id = NULL
WHERE tester_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainers.id = course_runs.tester_id);

-- Clean up orphaned template_ids in marketing_campaigns
UPDATE marketing_campaigns
SET template_id = NULL
WHERE template_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM email_templates WHERE email_templates.id = marketing_campaigns.template_id);
