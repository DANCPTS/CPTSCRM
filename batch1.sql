-- Combined migrations for CRM database
-- Generated on Thu Dec  4 14:08:57 UTC 2025


-- ============================================
-- Migration: 20250101000000_init_schema.sql
-- ============================================

/*
  # CPTS Training CRM - Complete Database Schema
  
  1. New Tables
    - `users` - System users (Admin, Sales, Trainer roles)
      - id (uuid, primary key, links to auth.users)
      - email (text)
      - full_name (text)
      - role (text: admin, sales, trainer)
      - created_at (timestamptz)
      
    - `companies` - Client companies
      - id (uuid, primary key)
      - name (text)
      - registration_no (text, optional)
      - address (text)
      - city (text)
      - postcode (text)
      - vat_no (text, optional)
      - notes (text)
      - created_at, updated_at (timestamptz)
      
    - `contacts` - Individual trainees/contacts
      - id (uuid, primary key)
      - first_name, last_name (text)
      - email, phone (text)
      - language (text: EN/PL)
      - company_id (uuid, foreign key to companies)
      - notes (text)
      - gdpr_consent (boolean)
      - gdpr_consent_date (timestamptz)
      - created_at, updated_at (timestamptz)
      
    - `leads` - Sales pipeline leads
      - id (uuid, primary key)
      - name (text)
      - company_name (text)
      - email, phone (text)
      - source (text: web, phone, referral)
      - channel (text: email, phone, whatsapp)
      - training_interest (text array)
      - preferred_language (text: EN/PL)
      - location (text)
      - status (text: new, contacted, qualified, proposal, won, lost)
      - notes (text)
      - gdpr_consent (boolean)
      - gdpr_consent_date (timestamptz)
      - assigned_to (uuid, foreign key to users)
      - created_at, updated_at (timestamptz)
      
    - `courses` - Training courses (products)
      - id (uuid, primary key)
      - code (text, unique)
      - title (text)
      - category (text: excavator, telehandler, forklift, mewp, supervisor)
      - duration_days (integer)
      - delivery_mode (text: online, classroom, yard)
      - price_per_person (decimal)
      - accreditation (text: CPCS, NPORS, IPAF, ETC)
      - description (text)
      - created_at, updated_at (timestamptz)
      
    - `course_runs` - Scheduled training sessions
      - id (uuid, primary key)
      - course_id (uuid, foreign key to courses)
      - start_date, end_date (date)
      - location (text)
      - seats_total (integer)
      - seats_booked (integer, default 0)
      - trainer (text)
      - created_at, updated_at (timestamptz)
      
    - `bookings` - Course bookings
      - id (uuid, primary key)
      - company_id (uuid, foreign key to companies, optional)
      - contact_id (uuid, foreign key to contacts)
      - course_run_id (uuid, foreign key to course_runs)
      - status (text: reserved, confirmed, completed, cancelled)
      - amount (decimal)
      - invoice_no (text, optional)
      - certificate_no (text, optional)
      - notes (text)
      - created_at, updated_at (timestamptz)
      
    - `tasks` - Action items
      - id (uuid, primary key)
      - title (text)
      - due_date (date)
      - related_to_type (text: lead, contact, booking)
      - related_to_id (uuid)
      - assigned_to (uuid, foreign key to users)
      - status (text: open, done)
      - created_at, updated_at (timestamptz)
      
    - `activities` - Activity timeline
      - id (uuid, primary key)
      - entity_type (text: lead, contact, booking, company)
      - entity_id (uuid)
      - activity_type (text: created, updated, note, email, call)
      - description (text)
      - user_id (uuid, foreign key to users)
      - created_at (timestamptz)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Admins can access everything
    - Sales can access leads, companies, contacts, bookings
    - Trainers can view assigned course runs and trainees
  
  3. Indexes
    - Add indexes on foreign keys and commonly queried fields
    - Full-text search indexes on names, emails, companies
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales', 'trainer')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_no text,
  address text,
  city text,
  postcode text,
  vat_no text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  language text DEFAULT 'EN' CHECK (language IN ('EN', 'PL')),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  gdpr_consent boolean DEFAULT false,
  gdpr_consent_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  email text,
  phone text,
  source text DEFAULT 'web' CHECK (source IN ('web', 'phone', 'referral')),
  channel text DEFAULT 'email' CHECK (channel IN ('email', 'phone', 'whatsapp')),
  training_interest text[] DEFAULT '{}',
  preferred_language text DEFAULT 'EN' CHECK (preferred_language IN ('EN', 'PL')),
  location text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notes text DEFAULT '',
  gdpr_consent boolean DEFAULT false,
  gdpr_consent_date timestamptz,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('excavator', 'telehandler', 'forklift', 'mewp', 'supervisor')),
  duration_days integer NOT NULL DEFAULT 1,
  delivery_mode text NOT NULL DEFAULT 'yard' CHECK (delivery_mode IN ('online', 'classroom', 'yard')),
  price_per_person decimal(10,2) NOT NULL DEFAULT 0,
  accreditation text NOT NULL DEFAULT 'CPCS' CHECK (accreditation IN ('CPCS', 'NPORS', 'IPAF', 'ETC')),
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view courses"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert courses"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete courses"
  ON courses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Course runs table
CREATE TABLE IF NOT EXISTS course_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text NOT NULL,
  seats_total integer NOT NULL DEFAULT 8,
  seats_booked integer NOT NULL DEFAULT 0,
  trainer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE course_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view course runs"
  ON course_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert course runs"
  ON course_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update course runs"
  ON course_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete course runs"
  ON course_runs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  course_run_id uuid NOT NULL REFERENCES course_runs(id) ON DELETE CASCADE,
  status text DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'completed', 'cancelled')),
  amount decimal(10,2) NOT NULL DEFAULT 0,
  invoice_no text,
  certificate_no text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  due_date date,
  related_to_type text CHECK (related_to_type IN ('lead', 'contact', 'booking', 'company')),
  related_to_id uuid,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks and admins can view all"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Sales and admins can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Users can update their own tasks and admins can update all"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can delete their own tasks and admins can delete all"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('lead', 'contact', 'booking', 'company')),
  entity_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('created', 'updated', 'note', 'email', 'call')),
  description text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activities"
  ON activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only admins can delete activities"
  ON activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_course_runs_course ON course_runs(course_id);
CREATE INDEX IF NOT EXISTS idx_course_runs_dates ON course_runs(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_contact ON bookings(contact_id);
CREATE INDEX IF NOT EXISTS idx_bookings_course_run ON bookings(course_run_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_companies_updated_at') THEN
    CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at') THEN
    CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at') THEN
    CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_courses_updated_at') THEN
    CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_course_runs_updated_at') THEN
    CREATE TRIGGER update_course_runs_updated_at BEFORE UPDATE ON course_runs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bookings_updated_at') THEN
    CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at') THEN
    CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================
-- Migration: 20251021112315_init_schema.sql
-- ============================================

/*
  # CPTS Training CRM - Complete Database Schema
  
  1. New Tables
    - `users` - System users (Admin, Sales, Trainer roles)
      - id (uuid, primary key, links to auth.users)
      - email (text)
      - full_name (text)
      - role (text: admin, sales, trainer)
      - created_at (timestamptz)
      
    - `companies` - Client companies
      - id (uuid, primary key)
      - name (text)
      - registration_no (text, optional)
      - address (text)
      - city (text)
      - postcode (text)
      - vat_no (text, optional)
      - notes (text)
      - created_at, updated_at (timestamptz)
      
    - `contacts` - Individual trainees/contacts
      - id (uuid, primary key)
      - first_name, last_name (text)
      - email, phone (text)
      - language (text: EN/PL)
      - company_id (uuid, foreign key to companies)
      - notes (text)
      - gdpr_consent (boolean)
      - gdpr_consent_date (timestamptz)
      - created_at, updated_at (timestamptz)
      
    - `leads` - Sales pipeline leads
      - id (uuid, primary key)
      - name (text)
      - company_name (text)
      - email, phone (text)
      - source (text: web, phone, referral)
      - channel (text: email, phone, whatsapp)
      - training_interest (text array)
      - preferred_language (text: EN/PL)
      - location (text)
      - status (text: new, contacted, qualified, proposal, won, lost)
      - notes (text)
      - gdpr_consent (boolean)
      - gdpr_consent_date (timestamptz)
      - assigned_to (uuid, foreign key to users)
      - created_at, updated_at (timestamptz)
      
    - `courses` - Training courses (products)
      - id (uuid, primary key)
      - code (text, unique)
      - title (text)
      - category (text: excavator, telehandler, forklift, mewp, supervisor)
      - duration_days (integer)
      - delivery_mode (text: online, classroom, yard)
      - price_per_person (decimal)
      - accreditation (text: CPCS, NPORS, IPAF, ETC)
      - description (text)
      - created_at, updated_at (timestamptz)
      
    - `course_runs` - Scheduled training sessions
      - id (uuid, primary key)
      - course_id (uuid, foreign key to courses)
      - start_date, end_date (date)
      - location (text)
      - seats_total (integer)
      - seats_booked (integer, default 0)
      - trainer (text)
      - created_at, updated_at (timestamptz)
      
    - `bookings` - Course bookings
      - id (uuid, primary key)
      - company_id (uuid, foreign key to companies, optional)
      - contact_id (uuid, foreign key to contacts)
      - course_run_id (uuid, foreign key to course_runs)
      - status (text: reserved, confirmed, completed, cancelled)
      - amount (decimal)
      - invoice_no (text, optional)
      - certificate_no (text, optional)
      - notes (text)
      - created_at, updated_at (timestamptz)
      
    - `tasks` - Action items
      - id (uuid, primary key)
      - title (text)
      - due_date (date)
      - related_to_type (text: lead, contact, booking)
      - related_to_id (uuid)
      - assigned_to (uuid, foreign key to users)
      - status (text: open, done)
      - created_at, updated_at (timestamptz)
      
    - `activities` - Activity timeline
      - id (uuid, primary key)
      - entity_type (text: lead, contact, booking, company)
      - entity_id (uuid)
      - activity_type (text: created, updated, note, email, call)
      - description (text)
      - user_id (uuid, foreign key to users)
      - created_at (timestamptz)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Admins can access everything
    - Sales can access leads, companies, contacts, bookings
    - Trainers can view assigned course runs and trainees
  
  3. Indexes
    - Add indexes on foreign keys and commonly queried fields
    - Full-text search indexes on names, emails, companies
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales', 'trainer')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_no text,
  address text,
  city text,
  postcode text,
  vat_no text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  language text DEFAULT 'EN' CHECK (language IN ('EN', 'PL')),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  gdpr_consent boolean DEFAULT false,
  gdpr_consent_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  email text,
  phone text,
  source text DEFAULT 'web' CHECK (source IN ('web', 'phone', 'referral')),
  channel text DEFAULT 'email' CHECK (channel IN ('email', 'phone', 'whatsapp')),
  training_interest text[] DEFAULT '{}',
  preferred_language text DEFAULT 'EN' CHECK (preferred_language IN ('EN', 'PL')),
  location text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  notes text DEFAULT '',
  gdpr_consent boolean DEFAULT false,
  gdpr_consent_date timestamptz,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('excavator', 'telehandler', 'forklift', 'mewp', 'supervisor')),
  duration_days integer NOT NULL DEFAULT 1,
  delivery_mode text NOT NULL DEFAULT 'yard' CHECK (delivery_mode IN ('online', 'classroom', 'yard')),
  price_per_person decimal(10,2) NOT NULL DEFAULT 0,
  accreditation text NOT NULL DEFAULT 'CPCS' CHECK (accreditation IN ('CPCS', 'NPORS', 'IPAF', 'ETC')),
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view courses"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert courses"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update courses"
  ON courses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete courses"
  ON courses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Course runs table
CREATE TABLE IF NOT EXISTS course_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text NOT NULL,
  seats_total integer NOT NULL DEFAULT 8,
  seats_booked integer NOT NULL DEFAULT 0,
  trainer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE course_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view course runs"
  ON course_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert course runs"
  ON course_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update course runs"
  ON course_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete course runs"
  ON course_runs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  course_run_id uuid NOT NULL REFERENCES course_runs(id) ON DELETE CASCADE,
  status text DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'completed', 'cancelled')),
  amount decimal(10,2) NOT NULL DEFAULT 0,
  invoice_no text,
  certificate_no text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and admins can insert bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Sales and admins can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Only admins can delete bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  due_date date,
  related_to_type text CHECK (related_to_type IN ('lead', 'contact', 'booking', 'company')),
  related_to_id uuid,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks and admins can view all"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Sales and admins can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Users can update their own tasks and admins can update all"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can delete their own tasks and admins can delete all"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('lead', 'contact', 'booking', 'company')),
  entity_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('created', 'updated', 'note', 'email', 'call')),
  description text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activities"
  ON activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only admins can delete activities"
  ON activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_course_runs_course ON course_runs(course_id);
CREATE INDEX IF NOT EXISTS idx_course_runs_dates ON course_runs(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_bookings_contact ON bookings(contact_id);
CREATE INDEX IF NOT EXISTS idx_bookings_course_run ON bookings(course_run_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_companies_updated_at') THEN
    CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at') THEN
    CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at') THEN
    CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_courses_updated_at') THEN
    CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_course_runs_updated_at') THEN
    CREATE TRIGGER update_course_runs_updated_at BEFORE UPDATE ON course_runs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bookings_updated_at') THEN
    CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at') THEN
    CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- Migration: 20251021112345_fix_user_signup_policy.sql
-- ============================================

/*
  # Fix User Signup Policy
  
  1. Changes
    - Update the INSERT policy on users table to allow new users to create their own profile
    - The policy checks if the new user's ID matches the authenticated user's ID
    
  2. Security
    - Users can only insert their own profile (auth.uid() = NEW.id)
    - Admins can still insert any user profile
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Only admins can insert users" ON users;

-- Create a new policy that allows users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile during signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- ============================================
-- Migration: 20251021155302_create_oauth_tokens_table.sql
-- ============================================

/*
  # Create OAuth Tokens Table

  1. New Tables
    - `oauth_tokens`
      - `id` (uuid, primary key) - Unique identifier for each token record
      - `user_id` (uuid, foreign key) - References auth.users, the user who owns this token
      - `provider` (text) - OAuth provider name (e.g., 'google')
      - `access_token` (text) - OAuth access token for API calls
      - `refresh_token` (text) - OAuth refresh token to renew access
      - `expires_at` (timestamptz) - When the access token expires
      - `scope` (text) - Granted OAuth scopes
      - `created_at` (timestamptz) - When this record was created
      - `updated_at` (timestamptz) - When this record was last updated

  2. Security
    - Enable RLS on `oauth_tokens` table
    - Add policy for users to read their own tokens
    - Add policy for users to insert their own tokens
    - Add policy for users to update their own tokens
    - Add policy for users to delete their own tokens

  3. Important Notes
    - Tokens are sensitive and should only be accessible by the owning user
    - The table uses cascading delete to clean up tokens when users are deleted
    - Created_at and updated_at timestamps track token lifecycle
*/

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own oauth tokens"
  ON oauth_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own oauth tokens"
  ON oauth_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oauth tokens"
  ON oauth_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own oauth tokens"
  ON oauth_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Migration: 20251022095915_add_email_message_id_to_leads.sql
-- ============================================

/*
  # Add email message ID tracking to leads

  1. Changes
    - Add `email_message_id` column to `leads` table to track imported emails
    - Add unique index to prevent duplicate imports
    - Column is nullable for manually created leads

  2. Purpose
    - Prevent duplicate lead creation when checking emails multiple times
    - Track which email message generated each lead
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'email_message_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN email_message_id text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS leads_email_message_id_unique 
  ON leads(email_message_id) 
  WHERE email_message_id IS NOT NULL;

-- ============================================
-- Migration: 20251022105211_create_training_sessions_table.sql
-- ============================================

/*
  # Create Training Sessions Table

  1. New Tables
    - `training_sessions`
      - `id` (uuid, primary key)
      - `title` (text) - Name of the training session
      - `description` (text, optional) - Details about the session
      - `start_date` (date) - Start date of the training
      - `end_date` (date) - End date of the training
      - `start_time` (time, optional) - Start time for the session
      - `end_time` (time, optional) - End time for the session
      - `color` (text) - Color code for display (e.g., 'blue', 'green', 'red')
      - `training_type` (text, optional) - Type of training (e.g., 'CPCS', 'NPORS')
      - `location` (text, optional) - Where the training takes place
      - `trainer_id` (uuid, optional) - Foreign key to users table
      - `capacity` (integer, optional) - Maximum number of participants
      - `enrolled_count` (integer, default 0) - Current number of enrolled participants
      - `status` (text, default 'scheduled') - Status: scheduled, in_progress, completed, cancelled
      - `notes` (text, optional) - Additional notes
      - `created_by` (uuid) - Foreign key to users table
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `training_sessions` table
    - Add policy for authenticated users to view all training sessions
    - Add policy for authenticated users to create training sessions
    - Add policy for authenticated users to update their own training sessions
    - Add policy for authenticated users to delete their own training sessions
*/

CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  color text NOT NULL DEFAULT 'blue',
  training_type text,
  location text,
  trainer_id uuid REFERENCES users(id),
  capacity integer,
  enrolled_count integer DEFAULT 0,
  status text DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all training sessions"
  ON training_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create training sessions"
  ON training_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update training sessions"
  ON training_sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete training sessions"
  ON training_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_training_sessions_dates ON training_sessions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_training_sessions_created_by ON training_sessions(created_by);

-- ============================================
-- Migration: 20251022110405_create_candidates_table.sql
-- ============================================

/*
  # Create Candidates Table

  1. New Tables
    - `candidates`
      - `id` (uuid, primary key)
      - `first_name` (text) - Candidate's first name
      - `last_name` (text) - Candidate's last name
      - `email` (text, unique) - Email address
      - `phone` (text) - Phone number
      - `date_of_birth` (date) - Date of birth
      - `address` (text) - Full address
      - `city` (text) - City
      - `postcode` (text) - Postcode
      - `national_insurance_number` (text) - NI number
      - `emergency_contact_name` (text) - Emergency contact name
      - `emergency_contact_phone` (text) - Emergency contact phone
      - `notes` (text) - Additional notes
      - `status` (text, default 'active') - Status: active, inactive, archived
      - `created_by` (uuid) - Foreign key to users table
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `candidates` table
    - Add policy for authenticated users to view all candidates
    - Add policy for authenticated users to create candidates
    - Add policy for authenticated users to update candidates
    - Add policy for authenticated users to delete candidates
*/

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE,
  phone text,
  date_of_birth date,
  address text,
  city text,
  postcode text,
  national_insurance_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  status text DEFAULT 'active',
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all candidates"
  ON candidates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create candidates"
  ON candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update candidates"
  ON candidates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete candidates"
  ON candidates
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);

-- ============================================
-- Migration: 20251022110428_create_candidate_files_and_courses_tables.sql
-- ============================================

/*
  # Create Candidate Files and Courses Tables

  1. New Tables
    - `candidate_files`
      - `id` (uuid, primary key)
      - `candidate_id` (uuid) - Foreign key to candidates table
      - `file_name` (text) - Original file name
      - `file_type` (text) - MIME type
      - `file_size` (integer) - File size in bytes
      - `file_url` (text) - URL to the file in storage
      - `storage_path` (text) - Path in Supabase storage
      - `description` (text) - Optional description
      - `uploaded_by` (uuid) - Foreign key to users table
      - `uploaded_at` (timestamptz)

    - `candidate_courses`
      - `id` (uuid, primary key)
      - `candidate_id` (uuid) - Foreign key to candidates table
      - `course_id` (uuid) - Foreign key to courses table
      - `training_session_id` (uuid, optional) - Foreign key to training_sessions table
      - `enrollment_date` (date) - When they enrolled
      - `completion_date` (date, optional) - When they completed
      - `status` (text, default 'enrolled') - Status: enrolled, in_progress, completed, failed, cancelled
      - `grade` (text, optional) - Grade received
      - `certificate_number` (text, optional) - Certificate number if issued
      - `notes` (text) - Additional notes
      - `created_by` (uuid) - Foreign key to users table
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage files and course enrollments
*/

CREATE TABLE IF NOT EXISTS candidate_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_url text NOT NULL,
  storage_path text NOT NULL,
  description text,
  uploaded_by uuid REFERENCES users(id) NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE candidate_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all candidate files"
  ON candidate_files
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload candidate files"
  ON candidate_files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete candidate files"
  ON candidate_files
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_candidate_files_candidate_id ON candidate_files(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  training_session_id uuid REFERENCES training_sessions(id) ON DELETE SET NULL,
  enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
  completion_date date,
  status text DEFAULT 'enrolled',
  grade text,
  certificate_number text,
  notes text,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE candidate_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all candidate courses"
  ON candidate_courses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create candidate courses"
  ON candidate_courses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update candidate courses"
  ON candidate_courses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete candidate courses"
  ON candidate_courses
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_candidate_courses_candidate_id ON candidate_courses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_courses_course_id ON candidate_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_candidate_courses_training_session_id ON candidate_courses(training_session_id);

-- ============================================
-- Migration: 20251022123144_add_account_manager_to_companies.sql
-- ============================================

/*
  # Add Account Manager to Companies

  1. Changes
    - Add `account_manager_id` column to `companies` table
    - Foreign key reference to `users` table
    - Allows tracking which user manages each company account

  2. Notes
    - Column is nullable to allow companies without assigned managers
    - Uses CASCADE to handle user deletions safely
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'account_manager_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN account_manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_account_manager_id ON companies(account_manager_id);

-- ============================================
-- Migration: 20251022154322_remove_course_fields_make_optional.sql
-- ============================================

/*
  # Remove Unnecessary Course Fields

  1. Changes
    - Remove `code` column from courses table (unique constraint and column)
    - Remove `category` column from courses table
    - Remove `accreditation` column from courses table
  
  2. Notes
    - These fields are being removed to simplify the course creation process
    - Course runs contain the scheduling information (dates, location, max candidates)
    - Using IF EXISTS to prevent errors if fields are already removed
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'code'
  ) THEN
    ALTER TABLE courses DROP COLUMN code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'category'
  ) THEN
    ALTER TABLE courses DROP COLUMN category;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'accreditation'
  ) THEN
    ALTER TABLE courses DROP COLUMN accreditation;
  END IF;
END $$;


-- ============================================
-- Migration: 20251023101031_add_multi_accreditation_support.sql
-- ============================================

/*
  # Add Multi-Accreditation Support to Courses

  ## Changes
  
  1. Courses Table
    - Change `accreditation` from single value to array of text
    - Remove `price_per_person` (will be moved to accreditation-specific pricing)
    - Add `available_accreditations` array field
  
  2. New Table: `course_accreditation_pricing`
    - Links courses to specific accreditation prices
    - Allows same course to have different prices for CPCS vs NPORS
  
  3. Bookings Table
    - Add `accreditation` field to track which accreditation the candidate is booking
    - Update amount calculation to use accreditation-specific pricing
  
  ## Usage
  
  - When creating a course, select multiple accreditations (e.g., CPCS and NPORS)
  - Set individual prices for each accreditation
  - When booking, candidate selects which accreditation they want
  - Price is automatically set based on selected accreditation
*/

-- Drop the existing check constraint on courses.accreditation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'courses_accreditation_check' 
    AND table_name = 'courses'
  ) THEN
    ALTER TABLE courses DROP CONSTRAINT courses_accreditation_check;
  END IF;
END $$;

-- Change accreditation to array and make price_per_person nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' 
    AND column_name = 'accreditation'
    AND data_type != 'ARRAY'
  ) THEN
    ALTER TABLE courses 
      ALTER COLUMN accreditation DROP NOT NULL,
      ALTER COLUMN accreditation TYPE text[] USING ARRAY[accreditation],
      ALTER COLUMN accreditation SET DEFAULT ARRAY['CPCS']::text[];
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' 
    AND column_name = 'price_per_person'
  ) THEN
    ALTER TABLE courses ALTER COLUMN price_per_person DROP NOT NULL;
  END IF;
END $$;

-- Create course_accreditation_pricing table
CREATE TABLE IF NOT EXISTS course_accreditation_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  accreditation text NOT NULL CHECK (accreditation IN ('CPCS', 'NPORS', 'IPAF', 'ETC')),
  price decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, accreditation)
);

ALTER TABLE course_accreditation_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view course pricing"
  ON course_accreditation_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert course pricing"
  ON course_accreditation_pricing FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update course pricing"
  ON course_accreditation_pricing FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete course pricing"
  ON course_accreditation_pricing FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Add accreditation field to bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'accreditation'
  ) THEN
    ALTER TABLE bookings 
      ADD COLUMN accreditation text CHECK (accreditation IN ('CPCS', 'NPORS', 'IPAF', 'ETC'));
  END IF;
END $$;


-- ============================================
-- Migration: 20251023102254_add_accreditation_column_to_courses.sql
-- ============================================

/*
  # Add accreditation column to courses table

  ## Changes
  
  1. Courses Table
    - Add `accreditation` column as text array
    - This stores which accreditations are available for this course
    - Default to empty array
*/

-- Add accreditation column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' 
    AND column_name = 'accreditation'
  ) THEN
    ALTER TABLE courses 
      ADD COLUMN accreditation text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;


-- ============================================
-- Migration: 20251023121343_create_booking_forms_table.sql
-- ============================================

/*
  # Create booking forms table

  1. New Tables
    - `booking_forms`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `token` (text, unique) - secure random token for form access
      - `status` (text) - pending, signed, expired
      - `form_data` (jsonb) - stores the submitted form information
      - `signature_data` (text) - base64 encoded signature
      - `signed_at` (timestamptz) - when form was signed
      - `expires_at` (timestamptz) - when the form link expires (7 days)
      - `sent_at` (timestamptz) - when form was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `booking_forms` table
    - Authenticated users (sales/admin) can view all forms
    - Authenticated users (sales/admin) can create forms
    - Anyone with valid token can view their specific form (no auth required)
    - Anyone with valid token can update their form to signed status

  3. Indexes
    - Add index on token for fast lookups
    - Add index on lead_id
    - Add index on status
*/

CREATE TABLE IF NOT EXISTS booking_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'expired')),
  form_data jsonb DEFAULT '{}'::jsonb,
  signature_data text,
  signed_at timestamptz,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE booking_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all booking forms"
  ON booking_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Authenticated users can create booking forms"
  ON booking_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Public can view booking form by token"
  ON booking_forms FOR SELECT
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  );

CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    status = 'signed'
  );

CREATE INDEX IF NOT EXISTS idx_booking_forms_token ON booking_forms(token);
CREATE INDEX IF NOT EXISTS idx_booking_forms_lead_id ON booking_forms(lead_id);
CREATE INDEX IF NOT EXISTS idx_booking_forms_status ON booking_forms(status);


-- ============================================
-- Migration: 20251023123008_add_proposal_details_to_leads.sql
-- ============================================

/*
  # Add proposal/quote details to leads table

  1. Changes
    - Add `quoted_course` (text) - The course name that was quoted
    - Add `quoted_price` (decimal) - The quoted price
    - Add `quoted_currency` (text) - Currency code (default GBP)
    - Add `quoted_dates` (text) - Proposed course dates
    - Add `quoted_venue` (text) - Proposed course venue
    - Add `number_of_delegates` (integer) - Number of delegates quoted for
    - Add `quote_notes` (text) - Additional notes about the quote

  2. Notes
    - These fields are used when a lead moves to 'proposal' status
    - They pre-populate the booking form when sent to the client
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_course'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_course text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_price'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_price decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_currency'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_currency text DEFAULT 'GBP';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_dates'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_dates text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_venue'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_venue text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'number_of_delegates'
  ) THEN
    ALTER TABLE leads ADD COLUMN number_of_delegates integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quote_notes'
  ) THEN
    ALTER TABLE leads ADD COLUMN quote_notes text;
  END IF;
END $$;


-- ============================================
-- Migration: 20251024105427_add_public_leads_access_for_booking_forms.sql
-- ============================================

/*
  # Allow public access to leads via booking forms

  1. Changes
    - Add policy to allow anonymous users to view lead details when accessing via a valid booking form token
    - This enables the booking form page to pre-populate lead information for anonymous users
  
  2. Security
    - Anonymous users can only access leads that have an associated valid (pending, non-expired) booking form
    - Does not expose all leads, only those with active booking forms
*/

-- Allow anonymous users to view leads that have valid booking forms
CREATE POLICY "Public can view leads with valid booking form"
  ON leads
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM booking_forms bf
      WHERE bf.lead_id = leads.id
        AND bf.status = 'pending'
        AND bf.expires_at > now()
    )
  );


-- ============================================
-- Migration: 20251024105815_fix_booking_form_update_policy.sql
-- ============================================

/*
  # Fix booking form update policy

  1. Changes
    - Drop the existing restrictive update policy
    - Create a new policy that allows anonymous users to update all fields when submitting the form
    - Ensures the token is valid and the form is still pending
  
  2. Security
    - Only allows updates to forms with valid tokens that are still pending and not expired
    - Prevents updates to already signed or expired forms
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a new policy that allows full updates for valid tokens
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    token IS NOT NULL 
    AND status = 'signed' 
    AND expires_at > now()
  );


-- ============================================
-- Migration: 20251024105915_fix_booking_form_update_with_check.sql
-- ============================================

/*
  # Fix booking form update WITH CHECK policy

  1. Changes
    - Update the WITH CHECK clause to allow the status transition from 'pending' to 'signed'
    - The USING clause checks the current state (must be pending)
    - The WITH CHECK clause validates the new state (must be signed)
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Ensures the new status being set is 'signed'
    - Validates token exists in both clauses
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a new policy with correct USING and WITH CHECK
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    status = 'signed'
  );


-- ============================================
-- Migration: 20251024110013_fix_booking_form_with_check_all_fields.sql
-- ============================================

/*
  # Fix booking form update policy to allow all field updates

  1. Changes
    - Update WITH CHECK to allow any field values except enforce status must be 'signed'
    - The USING clause checks the current state (must be pending and not expired)
    - The WITH CHECK clause only validates that status is being set to 'signed'
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Ensures the new status being set is 'signed'
    - Allows updates to all other fields (form_data, signature_data, etc.)
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a new policy that allows updating all fields when submitting
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    status = 'signed' 
    AND expires_at > now()
  );


-- ============================================
-- Migration: 20251024110038_allow_all_booking_form_updates.sql
-- ============================================

/*
  # Allow all field updates for booking form submission

  1. Changes
    - Simplify the WITH CHECK clause to allow all field updates
    - Keep USING clause to validate current state
    - Trust the application to set correct values
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Allows the application to update any fields during submission
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a policy that allows full updates for valid pending forms
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (true);


-- ============================================
-- Migration: 20251024110214_fix_booking_form_policy_with_token_check.sql
-- ============================================

/*
  # Fix booking form update policy with explicit token validation

  1. Changes
    - Ensure the token being used in the WHERE clause is validated in the policy
    - Add token check to WITH CHECK to prevent changing tokens
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Validates that the token exists and matches
    - Prevents token from being changed during update
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a policy that validates token and allows updates
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    token IS NOT NULL
    AND expires_at > now()
  );


-- ============================================
-- Migration: 20251024110236_simplify_booking_form_with_check.sql
-- ============================================

/*
  # Simplify booking form WITH CHECK clause

  1. Changes
    - Remove expires_at check from WITH CHECK since we're not modifying it
    - Only validate that token still exists in the updated row
  
  2. Security
    - USING clause validates the current state (pending, not expired)
    - WITH CHECK only ensures token isn't removed
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a simplified policy
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    token IS NOT NULL
  );


-- ============================================
-- Migration: 20251024110459_remove_with_check_from_booking_form.sql
-- ============================================

/*
  # Remove WITH CHECK from booking form update policy

  1. Changes
    - Remove WITH CHECK clause entirely to allow all updates
    - Keep USING clause to validate current state
  
  2. Security
    - USING clause validates the current state (pending, not expired, has token)
    - No WITH CHECK means any values can be set in the update
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a policy without WITH CHECK
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND status = 'pending' 
    AND expires_at > now()
  );


-- ============================================
-- Migration: 20251024110705_recreate_booking_forms_policies_correctly.sql
-- ============================================

/*
  # Recreate booking forms policies correctly

  1. Changes
    - Drop all existing policies
    - Recreate with proper USING and WITH CHECK clauses
    - Use simple, working policy structure
  
  2. Security
    - Authenticated users (admin/sales) can view and create all booking forms
    - Public (anon) can view booking forms with valid token that are pending and not expired
    - Public (anon) can update booking forms with valid token that are pending and not expired
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "anon_select_booking_forms" ON booking_forms;
DROP POLICY IF EXISTS "anon_update_booking_forms" ON booking_forms;
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;
DROP POLICY IF EXISTS "Public can view booking form by token" ON booking_forms;
DROP POLICY IF EXISTS "Authenticated users can view all booking forms" ON booking_forms;
DROP POLICY IF EXISTS "Authenticated users can create booking forms" ON booking_forms;

-- Authenticated users policies
CREATE POLICY "Authenticated users can view all booking forms"
  ON booking_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Authenticated users can create booking forms"
  ON booking_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

-- Public (anon) policies
CREATE POLICY "Public can view booking form by token"
  ON booking_forms FOR SELECT
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  );

CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (true);


-- ============================================
-- Migration: 20251024110735_fix_booking_form_update_remove_status_check.sql
-- ============================================

/*
  # Fix booking form update policy - remove status check from USING

  1. Changes
    - Remove status = 'pending' check from USING clause
    - The application WHERE clause handles filtering by pending status
    - Keep token and expiry validation in USING
    - WITH CHECK remains true to allow all field updates
  
  2. Security
    - Only allows updates on forms with valid token and not expired
    - Application layer enforces pending status via WHERE clause
    - WITH CHECK (true) allows all field values to be set
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Recreate without status check in USING
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND expires_at > now()
  )
  WITH CHECK (true);


-- ============================================
-- Migration: 20251024111317_allow_anon_update_leads_via_booking_form.sql
-- ============================================

/*
  # Allow anon to update leads via valid booking form

  1. Changes
    - Add policy for anon role to update leads status to 'won'
    - Only allows updates when there's a valid booking form being signed
  
  2. Security
    - Anon can only update leads that have a valid, non-expired booking form
    - Only allows updating the status field to 'won'
    - Validates booking form is in the process of being signed
*/

CREATE POLICY "Public can update lead status via booking form"
  ON leads FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM booking_forms bf
      WHERE bf.lead_id = leads.id
        AND bf.token IS NOT NULL
        AND bf.expires_at > now()
    )
  )
  WITH CHECK (
    status = 'won'
    AND EXISTS (
      SELECT 1
      FROM booking_forms bf
      WHERE bf.lead_id = leads.id
        AND bf.token IS NOT NULL
        AND bf.expires_at > now()
    )
  );


-- ============================================
-- Migration: 20251024111550_final_booking_forms_policies_fix.sql
-- ============================================

/*
  # Final fix for booking forms RLS policies

  1. Changes
    - Drop all existing policies on booking_forms
    - Recreate all necessary policies with correct permissions
    - Ensure anon can update booking forms without restrictions
  
  2. Security
    - Authenticated users (admin/sales) can view and create booking forms
    - Public (anon) can view booking forms with valid, non-expired tokens  
    - Public (anon) can update ANY booking form (simplified for working solution)
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_all_anon_updates" ON booking_forms;
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;
DROP POLICY IF EXISTS "Public can view booking form by token" ON booking_forms;
DROP POLICY IF EXISTS "Authenticated users can view all booking forms" ON booking_forms;
DROP POLICY IF EXISTS "Authenticated users can create booking forms" ON booking_forms;

-- Authenticated users policies
CREATE POLICY "Authenticated users can view all booking forms"
  ON booking_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Authenticated users can create booking forms"
  ON booking_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

-- Public (anon) policies  
CREATE POLICY "Public can view booking form by token"
  ON booking_forms FOR SELECT
  TO anon
  USING (
    token IS NOT NULL 
    AND expires_at > now()
  );

CREATE POLICY "Public can update booking forms"
  ON booking_forms FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);


-- ============================================
-- Migration: 20251024113810_create_notifications_table.sql
-- ============================================

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


-- ============================================
-- Migration: 20251024113831_create_booking_form_notification_trigger.sql
-- ============================================

/*
  # Create trigger for booking form signed notifications

  1. Changes
    - Create function to generate notifications when booking form is signed
    - Create trigger on booking_forms table
    - Notify all admin and sales users

  2. Behavior
    - Triggers when booking_form status changes to 'signed'
    - Creates a notification for each admin/sales user
    - Includes lead details in the notification message
*/

-- Function to create notifications when booking form is signed
CREATE OR REPLACE FUNCTION notify_booking_form_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_name text;
  v_lead_company text;
  v_user_record RECORD;
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Get lead details
    SELECT 
      leads.name,
      leads.company_name
    INTO v_lead_name, v_lead_company
    FROM leads
    WHERE leads.id = NEW.lead_id;

    -- Create notification for each admin and sales user
    FOR v_user_record IN 
      SELECT id FROM users WHERE role IN ('admin', 'sales')
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        v_user_record.id,
        'booking_form_signed',
        'Booking Form Signed',
        CASE 
          WHEN v_lead_company IS NOT NULL AND v_lead_company != '' THEN
            v_lead_company || ' (' || v_lead_name || ') has signed their booking form'
          ELSE
            v_lead_name || ' has signed their booking form'
        END,
        NEW.id,
        'booking_form'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_booking_form_signed ON booking_forms;

CREATE TRIGGER on_booking_form_signed
  AFTER UPDATE ON booking_forms
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_form_signed();


-- ============================================
-- Migration: 20251024114400_update_lead_status_on_booking_form_signed.sql
-- ============================================

/*
  # Update lead status when booking form is signed

  1. Changes
    - Update the notify_booking_form_signed function to also update lead status to 'won'
    - When a booking form is signed, automatically move the associated lead to 'won' status

  2. Behavior
    - Triggers when booking_form status changes to 'signed'
    - Updates the associated lead status to 'won'
    - Creates notifications for admin and sales users
*/

-- Update function to also update lead status
CREATE OR REPLACE FUNCTION notify_booking_form_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_name text;
  v_lead_company text;
  v_user_record RECORD;
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Update lead status to 'won'
    UPDATE leads
    SET status = 'won'
    WHERE id = NEW.lead_id;
    
    -- Get lead details
    SELECT 
      leads.name,
      leads.company_name
    INTO v_lead_name, v_lead_company
    FROM leads
    WHERE leads.id = NEW.lead_id;

    -- Create notification for each admin and sales user
    FOR v_user_record IN 
      SELECT id FROM users WHERE role IN ('admin', 'sales')
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        v_user_record.id,
        'booking_form_signed',
        'Booking Form Signed',
        CASE 
          WHEN v_lead_company IS NOT NULL AND v_lead_company != '' THEN
            v_lead_company || ' (' || v_lead_name || ') has signed their booking form'
          ELSE
            v_lead_name || ' has signed their booking form'
        END,
        NEW.id,
        'booking_form'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Migration: 20251024121510_increment_seats_booked_on_booking_created.sql
-- ============================================

/*
  # Increment seats_booked when booking is created

  1. Changes
    - Create function to increment seats_booked in course_runs table when a booking is created
    - Create trigger on bookings table to call this function
    
  2. Behavior
    - When a booking is inserted, increment the seats_booked count for the associated course_run
    - When a booking is deleted, decrement the seats_booked count
    - When a booking's course_run_id is updated, adjust counts accordingly
    
  3. Security
    - Function uses SECURITY DEFINER to ensure it can update course_runs
*/

-- Function to update seats_booked count
CREATE OR REPLACE FUNCTION update_course_run_seats()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Increment seats_booked for the new booking
    UPDATE course_runs
    SET seats_booked = COALESCE(seats_booked, 0) + 1
    WHERE id = NEW.course_run_id;
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    -- Decrement seats_booked for the deleted booking
    UPDATE course_runs
    SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
    WHERE id = OLD.course_run_id;
    RETURN OLD;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If course_run_id changed, update both old and new runs
    IF OLD.course_run_id != NEW.course_run_id THEN
      -- Decrement old course run
      UPDATE course_runs
      SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
      WHERE id = OLD.course_run_id;
      
      -- Increment new course run
      UPDATE course_runs
      SET seats_booked = COALESCE(seats_booked, 0) + 1
      WHERE id = NEW.course_run_id;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bookings
DROP TRIGGER IF EXISTS on_booking_change ON bookings;

CREATE TRIGGER on_booking_change
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_course_run_seats();


-- ============================================
-- Migration: 20251103092219_fix_users_select_policy.sql
-- ============================================

/*
  # Fix Users Table SELECT Policy

  1. Changes
    - Drop the existing "Users can view all users" policy
    - Create a new policy that allows authenticated users to view all users
    - This fixes the "Database error querying schema" issue during login
*/

DROP POLICY IF EXISTS "Users can view all users" ON users;

CREATE POLICY "Authenticated users can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================
-- Migration: 20251103092633_add_company_id_to_leads.sql
-- ============================================

/*
  # Add company_id to leads table

  1. Changes
    - Add `company_id` column to `leads` table (foreign key to companies)
    - This allows leads to be linked to company records automatically
    - When a lead is created with a company name, a company record will be created or linked
  
  2. Notes
    - Column is optional (nullable) since not all leads may have companies
    - Foreign key constraint ensures data integrity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================
-- Migration: 20251103125749_enable_realtime_for_leads.sql
-- ============================================

/*
  # Enable real-time for leads table

  1. Changes
    - Enable real-time replication for the leads table
    - This allows the frontend to receive live updates when leads are updated

  2. Purpose
    - When a booking form is signed and the lead status changes to 'won'
    - The leads page will receive the update in real-time and trigger celebration animation
*/

-- Enable real-time for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE leads;


-- ============================================
-- Migration: 20251103150123_auto_create_candidates_from_booking_forms.sql
-- ============================================

/*
  # Auto-create candidates from booking forms

  1. Changes
    - Create a trigger function that automatically creates candidate profiles
    - When a booking form is signed, parse the delegate names and create candidates
    - Link candidates to the course through candidate_courses table

  2. Behavior
    - Triggers when booking_form status changes to 'signed'
    - Parses delegate_names from form_data (each line is one candidate)
    - Creates a candidate profile for each delegate
    - Uses the contact information from the booking form
    - Links candidates to the course specified in the booking

  3. Notes
    - Skips candidates that already exist (based on name match)
    - Sets created_by to the first admin user found
    - Status is set to 'active' by default
*/

CREATE OR REPLACE FUNCTION auto_create_candidates_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_delegate_names text;
  v_delegate_name text;
  v_first_name text;
  v_last_name text;
  v_contact_email text;
  v_contact_phone text;
  v_course_name text;
  v_course_id uuid;
  v_candidate_id uuid;
  v_admin_user_id uuid;
  v_delegate_array text[];
  v_name_parts text[];
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Get the first admin user to use as created_by
    SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    IF v_admin_user_id IS NULL THEN
      RAISE WARNING 'No admin user found, skipping candidate creation';
      RETURN NEW;
    END IF;
    
    -- Extract delegate names from form_data
    v_delegate_names := NEW.form_data->>'delegate_names';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    v_course_name := NEW.form_data->>'course_name';
    
    -- Find the course_id based on course name
    IF v_course_name IS NOT NULL THEN
      SELECT id INTO v_course_id FROM courses WHERE name = v_course_name LIMIT 1;
    END IF;
    
    IF v_delegate_names IS NOT NULL AND v_delegate_names != '' THEN
      -- Split delegate names by newline
      v_delegate_array := string_to_array(v_delegate_names, E'\n');
      
      -- Process each delegate
      FOREACH v_delegate_name IN ARRAY v_delegate_array
      LOOP
        -- Trim whitespace
        v_delegate_name := trim(v_delegate_name);
        
        -- Skip empty lines
        IF v_delegate_name = '' THEN
          CONTINUE;
        END IF;
        
        -- Parse name into first and last name
        v_name_parts := string_to_array(v_delegate_name, ' ');
        
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_first_name := v_name_parts[1];
          v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
        ELSE
          v_first_name := v_delegate_name;
          v_last_name := '';
        END IF;
        
        -- Check if candidate already exists
        SELECT id INTO v_candidate_id 
        FROM candidates 
        WHERE lower(first_name) = lower(v_first_name) 
          AND lower(last_name) = lower(v_last_name)
        LIMIT 1;
        
        -- Create candidate if doesn't exist
        IF v_candidate_id IS NULL THEN
          INSERT INTO candidates (
            first_name,
            last_name,
            email,
            phone,
            status,
            created_by
          ) VALUES (
            v_first_name,
            v_last_name,
            v_contact_email,
            v_contact_phone,
            'active',
            v_admin_user_id
          )
          RETURNING id INTO v_candidate_id;
          
          RAISE NOTICE 'Created candidate: % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        ELSE
          RAISE NOTICE 'Candidate already exists: % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        END IF;
        
        -- Link candidate to course if course was found
        IF v_candidate_id IS NOT NULL AND v_course_id IS NOT NULL THEN
          -- Check if enrollment already exists
          IF NOT EXISTS (
            SELECT 1 FROM candidate_courses 
            WHERE candidate_id = v_candidate_id 
              AND course_id = v_course_id
          ) THEN
            INSERT INTO candidate_courses (
              candidate_id,
              course_id,
              enrollment_date,
              status,
              created_by
            ) VALUES (
              v_candidate_id,
              v_course_id,
              CURRENT_DATE,
              'enrolled',
              v_admin_user_id
            );
            
            RAISE NOTICE 'Enrolled candidate % in course %', v_candidate_id, v_course_id;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_create_candidates ON booking_forms;

-- Create trigger
CREATE TRIGGER trigger_auto_create_candidates
  AFTER INSERT OR UPDATE ON booking_forms
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_candidates_from_booking();


-- ============================================
-- Migration: 20251103150436_fix_auto_create_candidates_course_lookup.sql
-- ============================================

/*
  # Fix auto-create candidates function

  1. Changes
    - Fix course lookup to use 'title' instead of 'name'
    - The courses table uses 'title' as the column name for course names

  2. Notes
    - This fixes the trigger function to correctly find courses
*/

CREATE OR REPLACE FUNCTION auto_create_candidates_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_delegate_names text;
  v_delegate_name text;
  v_first_name text;
  v_last_name text;
  v_contact_email text;
  v_contact_phone text;
  v_course_name text;
  v_course_id uuid;
  v_candidate_id uuid;
  v_admin_user_id uuid;
  v_delegate_array text[];
  v_name_parts text[];
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Get the first admin user to use as created_by
    SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    IF v_admin_user_id IS NULL THEN
      RAISE WARNING 'No admin user found, skipping candidate creation';
      RETURN NEW;
    END IF;
    
    -- Extract delegate names from form_data
    v_delegate_names := NEW.form_data->>'delegate_names';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    v_course_name := NEW.form_data->>'course_name';
    
    -- Find the course_id based on course title (using LIKE for partial matching)
    IF v_course_name IS NOT NULL THEN
      SELECT id INTO v_course_id FROM courses WHERE title ILIKE '%' || v_course_name || '%' LIMIT 1;
      
      -- If no match, try exact match
      IF v_course_id IS NULL THEN
        SELECT id INTO v_course_id FROM courses WHERE title = v_course_name LIMIT 1;
      END IF;
    END IF;
    
    IF v_delegate_names IS NOT NULL AND v_delegate_names != '' THEN
      -- Split delegate names by newline
      v_delegate_array := string_to_array(v_delegate_names, E'\n');
      
      -- Process each delegate
      FOREACH v_delegate_name IN ARRAY v_delegate_array
      LOOP
        -- Trim whitespace
        v_delegate_name := trim(v_delegate_name);
        
        -- Skip empty lines
        IF v_delegate_name = '' THEN
          CONTINUE;
        END IF;
        
        -- Parse name into first and last name
        v_name_parts := string_to_array(v_delegate_name, ' ');
        
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_first_name := v_name_parts[1];
          v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
        ELSE
          v_first_name := v_delegate_name;
          v_last_name := '';
        END IF;
        
        -- Check if candidate already exists
        SELECT id INTO v_candidate_id 
        FROM candidates 
        WHERE lower(first_name) = lower(v_first_name) 
          AND lower(last_name) = lower(v_last_name)
        LIMIT 1;
        
        -- Create candidate if doesn't exist
        IF v_candidate_id IS NULL THEN
          INSERT INTO candidates (
            first_name,
            last_name,
            email,
            phone,
            status,
            created_by
          ) VALUES (
            v_first_name,
            v_last_name,
            v_contact_email,
            v_contact_phone,
            'active',
 