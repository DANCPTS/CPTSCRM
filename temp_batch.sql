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
-- Migration: 20251022110428_create_