/*
  # Comprehensive Orphaned Data Cleanup

  1. Purpose
    - Clean up all orphaned records before adding foreign keys
    - Ensures foreign key constraints can be added without violations
*/

-- Delete orphaned attendance records
DELETE FROM attendance
WHERE candidate_course_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM candidate_courses WHERE candidate_courses.id = attendance.candidate_course_id);

-- Delete orphaned candidate_courses
DELETE FROM candidate_courses
WHERE candidate_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM candidates WHERE candidates.id = candidate_courses.candidate_id);

DELETE FROM candidate_courses
WHERE course_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM courses WHERE courses.id = candidate_courses.course_id);

-- Delete orphaned calendar_settings
DELETE FROM calendar_settings
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = calendar_settings.user_id);

-- Delete orphaned oauth_tokens
DELETE FROM oauth_tokens
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = oauth_tokens.user_id);

-- Delete orphaned notifications
DELETE FROM notifications
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = notifications.user_id);

-- Delete orphaned campaign_recipients
DELETE FROM campaign_recipients
WHERE campaign_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM marketing_campaigns WHERE marketing_campaigns.id = campaign_recipients.campaign_id);

-- Delete orphaned note_extractions
DELETE FROM note_extractions
WHERE note_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM notes WHERE notes.id = note_extractions.note_id);

-- Delete orphaned trainer_certifications
DELETE FROM trainer_certifications
WHERE trainer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainers.id = trainer_certifications.trainer_id);

-- Delete orphaned course_accreditation_pricing
DELETE FROM course_accreditation_pricing
WHERE course_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM courses WHERE courses.id = course_accreditation_pricing.course_id);

-- Delete orphaned notes (must be done before cleaning bookings/candidates/companies/tasks)
DELETE FROM notes
WHERE booking_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM bookings WHERE bookings.id = notes.booking_id);

DELETE FROM notes
WHERE candidate_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM candidates WHERE candidates.id = notes.candidate_id);

DELETE FROM notes
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies WHERE companies.id = notes.company_id);

DELETE FROM notes
WHERE task_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.id = notes.task_id);

-- Clean up NULL-able foreign keys
UPDATE candidate_courses SET course_run_id = NULL
WHERE course_run_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM course_runs WHERE course_runs.id = candidate_courses.course_run_id);

UPDATE candidate_courses SET training_session_id = NULL
WHERE training_session_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM training_sessions WHERE training_sessions.id = candidate_courses.training_session_id);

UPDATE bookings SET candidate_id = NULL
WHERE candidate_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM candidates WHERE candidates.id = bookings.candidate_id);

UPDATE bookings SET company_id = NULL
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies WHERE companies.id = bookings.company_id);

UPDATE bookings SET contact_id = NULL
WHERE contact_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM contacts WHERE contacts.id = bookings.contact_id);

UPDATE contacts SET company_id = NULL
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies WHERE companies.id = contacts.company_id);

UPDATE leads SET company_id = NULL
WHERE company_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM companies WHERE companies.id = leads.company_id);

UPDATE course_runs SET trainer_id = NULL
WHERE trainer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainers.id = course_runs.trainer_id);

UPDATE course_runs SET tester_id = NULL
WHERE tester_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainers.id = course_runs.tester_id);

UPDATE marketing_campaigns SET template_id = NULL
WHERE template_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM email_templates WHERE email_templates.id = marketing_campaigns.template_id);

UPDATE training_sessions SET trainer_id = NULL
WHERE trainer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainers.id = training_sessions.trainer_id);
