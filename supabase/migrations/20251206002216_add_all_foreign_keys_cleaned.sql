/*
  # Add All Missing Foreign Key Constraints

  1. Purpose
    - Add foreign key constraints to enable proper Supabase joins
    - Ensures data integrity across all tables
  
  2. Notes
    - All orphaned data has been cleaned up
    - Foreign keys use appropriate ON DELETE actions
*/

-- attendance
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS attendance_candidate_course_id_fkey,
ADD CONSTRAINT attendance_candidate_course_id_fkey
FOREIGN KEY (candidate_course_id) REFERENCES candidate_courses(id) ON DELETE CASCADE;

-- bookings
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_candidate_id_fkey,
ADD CONSTRAINT bookings_candidate_id_fkey
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_company_id_fkey,
ADD CONSTRAINT bookings_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_contact_id_fkey,
ADD CONSTRAINT bookings_contact_id_fkey
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_course_run_id_fkey,
ADD CONSTRAINT bookings_course_run_id_fkey
FOREIGN KEY (course_run_id) REFERENCES course_runs(id) ON DELETE CASCADE;

-- calendar_settings
ALTER TABLE calendar_settings
DROP CONSTRAINT IF EXISTS calendar_settings_user_id_fkey,
ADD CONSTRAINT calendar_settings_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- campaign_recipients
ALTER TABLE campaign_recipients
DROP CONSTRAINT IF EXISTS campaign_recipients_campaign_id_fkey,
ADD CONSTRAINT campaign_recipients_campaign_id_fkey
FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE;

-- candidate_courses
ALTER TABLE candidate_courses
DROP CONSTRAINT IF EXISTS candidate_courses_candidate_id_fkey,
ADD CONSTRAINT candidate_courses_candidate_id_fkey
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

ALTER TABLE candidate_courses
DROP CONSTRAINT IF EXISTS candidate_courses_course_id_fkey,
ADD CONSTRAINT candidate_courses_course_id_fkey
FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE candidate_courses
DROP CONSTRAINT IF EXISTS candidate_courses_course_run_id_fkey,
ADD CONSTRAINT candidate_courses_course_run_id_fkey
FOREIGN KEY (course_run_id) REFERENCES course_runs(id) ON DELETE SET NULL;

ALTER TABLE candidate_courses
DROP CONSTRAINT IF EXISTS candidate_courses_created_by_fkey,
ADD CONSTRAINT candidate_courses_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE candidate_courses
DROP CONSTRAINT IF EXISTS candidate_courses_training_session_id_fkey,
ADD CONSTRAINT candidate_courses_training_session_id_fkey
FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE SET NULL;

-- contacts
ALTER TABLE contacts
DROP CONSTRAINT IF EXISTS contacts_company_id_fkey,
ADD CONSTRAINT contacts_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- course_accreditation_pricing
ALTER TABLE course_accreditation_pricing
DROP CONSTRAINT IF EXISTS course_accreditation_pricing_course_id_fkey,
ADD CONSTRAINT course_accreditation_pricing_course_id_fkey
FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

-- course_runs
ALTER TABLE course_runs
DROP CONSTRAINT IF EXISTS course_runs_course_id_fkey,
ADD CONSTRAINT course_runs_course_id_fkey
FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE course_runs
DROP CONSTRAINT IF EXISTS course_runs_trainer_id_fkey,
ADD CONSTRAINT course_runs_trainer_id_fkey
FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL;

ALTER TABLE course_runs
DROP CONSTRAINT IF EXISTS course_runs_tester_id_fkey,
ADD CONSTRAINT course_runs_tester_id_fkey
FOREIGN KEY (tester_id) REFERENCES trainers(id) ON DELETE SET NULL;

-- email_templates
ALTER TABLE email_templates
DROP CONSTRAINT IF EXISTS email_templates_created_by_fkey,
ADD CONSTRAINT email_templates_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- leads
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_company_id_fkey,
ADD CONSTRAINT leads_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- marketing_campaigns
ALTER TABLE marketing_campaigns
DROP CONSTRAINT IF EXISTS marketing_campaigns_created_by_fkey,
ADD CONSTRAINT marketing_campaigns_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE marketing_campaigns
DROP CONSTRAINT IF EXISTS marketing_campaigns_template_id_fkey,
ADD CONSTRAINT marketing_campaigns_template_id_fkey
FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;

-- note_extractions
ALTER TABLE note_extractions
DROP CONSTRAINT IF EXISTS note_extractions_note_id_fkey,
ADD CONSTRAINT note_extractions_note_id_fkey
FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE;

-- notes
ALTER TABLE notes
DROP CONSTRAINT IF EXISTS notes_created_by_fkey,
ADD CONSTRAINT notes_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE notes
DROP CONSTRAINT IF EXISTS notes_booking_id_fkey,
ADD CONSTRAINT notes_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

ALTER TABLE notes
DROP CONSTRAINT IF EXISTS notes_candidate_id_fkey,
ADD CONSTRAINT notes_candidate_id_fkey
FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE;

ALTER TABLE notes
DROP CONSTRAINT IF EXISTS notes_company_id_fkey,
ADD CONSTRAINT notes_company_id_fkey
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE notes
DROP CONSTRAINT IF EXISTS notes_task_id_fkey,
ADD CONSTRAINT notes_task_id_fkey
FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- oauth_tokens
ALTER TABLE oauth_tokens
DROP CONSTRAINT IF EXISTS oauth_tokens_user_id_fkey,
ADD CONSTRAINT oauth_tokens_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- trainer_certifications
ALTER TABLE trainer_certifications
DROP CONSTRAINT IF EXISTS trainer_certifications_trainer_id_fkey,
ADD CONSTRAINT trainer_certifications_trainer_id_fkey
FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE;

-- trainers
ALTER TABLE trainers
DROP CONSTRAINT IF EXISTS trainers_created_by_fkey,
ADD CONSTRAINT trainers_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE trainers
DROP CONSTRAINT IF EXISTS trainers_user_id_fkey,
ADD CONSTRAINT trainers_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- training_sessions
ALTER TABLE training_sessions
DROP CONSTRAINT IF EXISTS training_sessions_created_by_fkey,
ADD CONSTRAINT training_sessions_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE training_sessions
DROP CONSTRAINT IF EXISTS training_sessions_trainer_id_fkey,
ADD CONSTRAINT training_sessions_trainer_id_fkey
FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL;
