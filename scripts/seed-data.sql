-- CPTS Training CRM - Demo Seed Data
-- This script populates the database with sample data for testing and demonstration

-- Sample Courses
INSERT INTO courses (code, title, category, duration_days, delivery_mode, price_per_person, accreditation, description)
VALUES
  ('EXC-360', 'Excavator 360° Above 10 Tonnes', 'excavator', 5, 'yard', 1250.00, 'CPCS', 'Comprehensive 360-degree excavator training for machines over 10 tonnes'),
  ('TEL-TH', 'Telehandler Training', 'telehandler', 3, 'yard', 850.00, 'CPCS', 'Full telehandler operation and safety training'),
  ('FLT-CB', 'Counterbalance Forklift', 'forklift', 3, 'yard', 750.00, 'NPORS', 'Counterbalance forklift operator certification'),
  ('MEWP-SL', 'MEWP Scissor Lift', 'mewp', 1, 'yard', 450.00, 'IPAF', 'Mobile Elevating Work Platform - Scissor lift training'),
  ('SSSTS', 'Site Supervisor Safety Training', 'supervisor', 2, 'classroom', 350.00, 'ETC', 'CITB Site Supervisor Safety Training Scheme')
ON CONFLICT (code) DO NOTHING;

-- Sample Companies
INSERT INTO companies (name, registration_no, address, city, postcode, vat_no, notes)
VALUES
  ('Scott Group Renewables (UK) Ltd', 'SC123456', '45 Industrial Estate', 'Wellingborough', 'NN8 4BX', 'GB123456789', 'Major renewable energy contractor'),
  ('MPH Construction Ltd', '12345678', '123 Builder Street', 'Northampton', 'NN1 1AA', 'GB987654321', 'General construction company'),
  ('Empire Training Services', '87654321', '78 Training Road', 'Kettering', 'NN15 5TT', NULL, 'Training services competitor - potential partnership'),
  ('Green Energy Solutions UK', 'GE998877', '12 Wind Farm Lane', 'Milton Keynes', 'MK9 2ZZ', 'GB112233445', 'Solar and wind energy specialists')
ON CONFLICT DO NOTHING;

-- Sample Contacts (linked to companies)
INSERT INTO contacts (first_name, last_name, email, phone, language, company_id, gdpr_consent, gdpr_consent_date, notes)
SELECT
  'John', 'Smith', 'john.smith@scottgroup.co.uk', '07700 900123', 'EN',
  (SELECT id FROM companies WHERE name = 'Scott Group Renewables (UK) Ltd' LIMIT 1),
  true, NOW(), 'Operations Manager'
WHERE EXISTS (SELECT 1 FROM companies WHERE name = 'Scott Group Renewables (UK) Ltd');

INSERT INTO contacts (first_name, last_name, email, phone, language, company_id, gdpr_consent, gdpr_consent_date, notes)
SELECT
  'Piotr', 'Kowalski', 'p.kowalski@mphconstruction.co.uk', '07700 900234', 'PL',
  (SELECT id FROM companies WHERE name = 'MPH Construction Ltd' LIMIT 1),
  true, NOW(), 'Site Supervisor - prefers Polish materials'
WHERE EXISTS (SELECT 1 FROM companies WHERE name = 'MPH Construction Ltd');

INSERT INTO contacts (first_name, last_name, email, phone, language, company_id, gdpr_consent, gdpr_consent_date, notes)
SELECT
  'Sarah', 'Williams', 'sarah.w@empiretraining.co.uk', '07700 900345', 'EN',
  (SELECT id FROM companies WHERE name = 'Empire Training Services' LIMIT 1),
  true, NOW(), 'Training Coordinator'
WHERE EXISTS (SELECT 1 FROM companies WHERE name = 'Empire Training Services');

INSERT INTO contacts (first_name, last_name, email, phone, language, company_id, gdpr_consent, gdpr_consent_date, notes)
SELECT
  'Michael', 'Brown', 'mbrown@greenenergy.co.uk', '07700 900456', 'EN',
  (SELECT id FROM companies WHERE name = 'Green Energy Solutions UK' LIMIT 1),
  true, NOW(), 'H&S Manager'
WHERE EXISTS (SELECT 1 FROM companies WHERE name = 'Green Energy Solutions UK');

INSERT INTO contacts (first_name, last_name, email, phone, language, gdpr_consent, gdpr_consent_date, notes)
VALUES
  ('Anna', 'Nowak', 'anna.nowak@email.com', '07700 900567', 'PL', true, NOW(), 'Independent operator'),
  ('David', 'Jones', 'djones@contractor.co.uk', '07700 900678', 'EN', true, NOW(), 'Freelance plant operator'),
  ('Karolina', 'Lewandowska', 'k.lewa@gmail.com', '07700 900789', 'PL', true, NOW(), 'Looking for multiple courses'),
  ('Robert', 'Taylor', 'rtaylor@buildersltd.co.uk', '07700 900890', 'EN', true, NOW(), 'Experienced forklift operator - renewal'),
  ('Tomasz', 'Wojcik', 'twojcik@hotmail.com', '07700 900991', 'PL', true, NOW(), 'First time trainee'),
  ('Emma', 'Wilson', 'emma.wilson@contractors.uk', '07700 901001', 'EN', true, NOW(), 'Supervisor training required');

-- Sample Leads (spread across pipeline stages)
-- Note: We'll need to get the user ID for assigned_to, so these will be unassigned initially
INSERT INTO leads (name, company_name, email, phone, source, channel, training_interest, preferred_language, location, status, notes, gdpr_consent, gdpr_consent_date)
VALUES
  ('James Anderson', 'Anderson Plant Hire', 'james@andersonplant.co.uk', '07700 902001', 'web', 'email', ARRAY['Excavator', 'Telehandler'], 'EN', 'Bedford', 'new', 'Interested in bulk booking for 5 operators', true, NOW()),
  ('Marcin Zielinski', 'MZ Construction', 'marcin@mzconstruction.pl', '07700 902002', 'phone', 'whatsapp', ARRAY['Forklift', 'MEWP'], 'PL', 'Northampton', 'contacted', 'Called on 15/01, requesting Polish instructor', true, NOW()),
  ('Sophie Clark', 'Clark Renewables', 'sophie@clarkrenewables.co.uk', '07700 902003', 'referral', 'email', ARRAY['Supervisor'], 'EN', 'Kettering', 'qualified', 'Referred by Scott Group, needs SSSTS urgently', true, NOW()),
  ('Lukasz Kaminski', NULL, 'lukasz.k@email.com', '07700 902004', 'web', 'phone', ARRAY['Excavator'], 'PL', 'Wellingborough', 'proposal', 'Sent quote for EXC-360, awaiting decision', true, NOW()),
  ('Richard Davies', 'Davies Logistics', 'richard@davieslogistics.co.uk', '07700 902005', 'phone', 'email', ARRAY['Forklift'], 'EN', 'Milton Keynes', 'won', 'Booked FLT-CB for next month', true, NOW()),
  ('Agnieszka Nowak', 'Nowak Services', 'agnieszka@nowakservices.pl', '07700 902006', 'web', 'whatsapp', ARRAY['Telehandler'], 'PL', 'Corby', 'lost', 'Chose competitor due to price', false, NULL),
  ('Chris Martin', 'Martin Construction', 'chris@martinconst.co.uk', '07700 902007', 'referral', 'email', ARRAY['MEWP', 'Supervisor'], 'EN', 'Rushden', 'contacted', 'Follow up scheduled for next week', true, NOW()),
  ('Katarzyna Wójcik', NULL, 'katarzyna.w@gmail.com', '07700 902008', 'web', 'email', ARRAY['Forklift', 'Telehandler'], 'PL', 'Wellingborough', 'new', 'Website enquiry received today', true, NOW());

-- Sample Course Runs (5 upcoming sessions)
INSERT INTO course_runs (course_id, start_date, end_date, location, seats_total, seats_booked, trainer)
SELECT
  (SELECT id FROM courses WHERE code = 'EXC-360' LIMIT 1),
  CURRENT_DATE + INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '11 days',
  'CPTS Yard, Wellingborough',
  8,
  5,
  'Steve Johnson'
WHERE EXISTS (SELECT 1 FROM courses WHERE code = 'EXC-360');

INSERT INTO course_runs (course_id, start_date, end_date, location, seats_total, seats_booked, trainer)
SELECT
  (SELECT id FROM courses WHERE code = 'FLT-CB' LIMIT 1),
  CURRENT_DATE + INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '5 days',
  'CPTS Yard, Wellingborough',
  10,
  8,
  'Mike Peters'
WHERE EXISTS (SELECT 1 FROM courses WHERE code = 'FLT-CB');

INSERT INTO course_runs (course_id, start_date, end_date, location, seats_total, seats_booked, trainer)
SELECT
  (SELECT id FROM courses WHERE code = 'SSSTS' LIMIT 1),
  CURRENT_DATE + INTERVAL '10 days',
  CURRENT_DATE + INTERVAL '11 days',
  'Online via Zoom',
  12,
  3,
  'Helen Davies'
WHERE EXISTS (SELECT 1 FROM courses WHERE code = 'SSSTS');

INSERT INTO course_runs (course_id, start_date, end_date, location, seats_total, seats_booked, trainer)
SELECT
  (SELECT id FROM courses WHERE code = 'TEL-TH' LIMIT 1),
  CURRENT_DATE + INTERVAL '14 days',
  CURRENT_DATE + INTERVAL '16 days',
  'CPTS Yard, Wellingborough',
  8,
  2,
  'Steve Johnson'
WHERE EXISTS (SELECT 1 FROM courses WHERE code = 'TEL-TH');

INSERT INTO course_runs (course_id, start_date, end_date, location, seats_total, seats_booked, trainer)
SELECT
  (SELECT id FROM courses WHERE code = 'MEWP-SL' LIMIT 1),
  CURRENT_DATE + INTERVAL '5 days',
  CURRENT_DATE + INTERVAL '5 days',
  'CPTS Yard, Wellingborough',
  12,
  9,
  'Andy Wilson'
WHERE EXISTS (SELECT 1 FROM courses WHERE code = 'MEWP-SL');

-- Sample Bookings (linked to contacts and course runs)
-- These will be inserted carefully with proper foreign key references

INSERT INTO bookings (company_id, contact_id, course_run_id, status, amount, invoice_no, notes)
SELECT
  (SELECT id FROM companies WHERE name = 'Scott Group Renewables (UK) Ltd' LIMIT 1),
  (SELECT id FROM contacts WHERE first_name = 'John' AND last_name = 'Smith' LIMIT 1),
  (SELECT id FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '7 days' LIMIT 1),
  'confirmed',
  1250.00,
  'INV-2025-001',
  'Paid in full'
WHERE EXISTS (SELECT 1 FROM contacts WHERE first_name = 'John' AND last_name = 'Smith')
  AND EXISTS (SELECT 1 FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '7 days');

INSERT INTO bookings (company_id, contact_id, course_run_id, status, amount, invoice_no, certificate_no, notes)
SELECT
  (SELECT id FROM companies WHERE name = 'MPH Construction Ltd' LIMIT 1),
  (SELECT id FROM contacts WHERE first_name = 'Piotr' AND last_name = 'Kowalski' LIMIT 1),
  (SELECT id FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '3 days' LIMIT 1),
  'completed',
  750.00,
  'INV-2024-089',
  'CERT-2024-456',
  'Course completed successfully'
WHERE EXISTS (SELECT 1 FROM contacts WHERE first_name = 'Piotr' AND last_name = 'Kowalski')
  AND EXISTS (SELECT 1 FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '3 days');

INSERT INTO bookings (contact_id, course_run_id, status, amount, notes)
SELECT
  (SELECT id FROM contacts WHERE first_name = 'Anna' AND last_name = 'Nowak' LIMIT 1),
  (SELECT id FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '14 days' LIMIT 1),
  'reserved',
  850.00,
  'Awaiting payment confirmation'
WHERE EXISTS (SELECT 1 FROM contacts WHERE first_name = 'Anna' AND last_name = 'Nowak')
  AND EXISTS (SELECT 1 FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '14 days');

INSERT INTO bookings (contact_id, course_run_id, status, amount, notes)
SELECT
  (SELECT id FROM contacts WHERE first_name = 'David' AND last_name = 'Jones' LIMIT 1),
  (SELECT id FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '5 days' LIMIT 1),
  'confirmed',
  450.00,
  'Early bird discount applied'
WHERE EXISTS (SELECT 1 FROM contacts WHERE first_name = 'David' AND last_name = 'Jones')
  AND EXISTS (SELECT 1 FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '5 days');

INSERT INTO bookings (contact_id, course_run_id, status, amount, notes)
SELECT
  (SELECT id FROM contacts WHERE first_name = 'Karolina' AND last_name = 'Lewandowska' LIMIT 1),
  (SELECT id FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '10 days' LIMIT 1),
  'confirmed',
  350.00,
  'Online session'
WHERE EXISTS (SELECT 1 FROM contacts WHERE first_name = 'Karolina' AND last_name = 'Lewandowska')
  AND EXISTS (SELECT 1 FROM course_runs WHERE start_date = CURRENT_DATE + INTERVAL '10 days');

-- Note: Tasks will need to be created with proper user_id references after users are created
-- The initial admin user will need to be created through the UI first
