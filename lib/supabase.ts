import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export type Database = {
  users: {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'sales' | 'trainer';
    created_at: string;
  };
  companies: {
    id: string;
    name: string;
    registration_no: string | null;
    address: string | null;
    city: string | null;
    postcode: string | null;
    vat_no: string | null;
    notes: string;
    created_at: string;
    updated_at: string;
  };
  contacts: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    language: 'EN' | 'PL';
    company_id: string | null;
    notes: string;
    gdpr_consent: boolean;
    gdpr_consent_date: string | null;
    created_at: string;
    updated_at: string;
  };
  leads: {
    id: string;
    name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    source: 'web' | 'phone' | 'referral';
    channel: 'email' | 'phone' | 'whatsapp';
    training_interest: string[];
    preferred_language: 'EN' | 'PL';
    location: string | null;
    status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
    notes: string;
    gdpr_consent: boolean;
    gdpr_consent_date: string | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
  };
  courses: {
    id: string;
    code: string;
    title: string;
    category: 'excavator' | 'telehandler' | 'forklift' | 'mewp' | 'supervisor';
    duration_days: number;
    delivery_mode: 'online' | 'classroom' | 'yard';
    price_per_person: number;
    accreditation: 'CPCS' | 'NPORS' | 'IPAF' | 'ETC';
    description: string;
    created_at: string;
    updated_at: string;
  };
  course_runs: {
    id: string;
    course_id: string;
    start_date: string;
    end_date: string;
    location: string;
    seats_total: number;
    seats_booked: number;
    trainer: string | null;
    created_at: string;
    updated_at: string;
  };
  bookings: {
    id: string;
    company_id: string | null;
    contact_id: string;
    course_run_id: string;
    status: 'reserved' | 'confirmed' | 'completed' | 'cancelled';
    amount: number;
    invoice_no: string | null;
    certificate_no: string | null;
    notes: string;
    created_at: string;
    updated_at: string;
  };
  tasks: {
    id: string;
    title: string;
    due_date: string | null;
    related_to_type: 'lead' | 'contact' | 'booking' | 'company' | null;
    related_to_id: string | null;
    assigned_to: string | null;
    status: 'open' | 'done';
    created_at: string;
    updated_at: string;
  };
  activities: {
    id: string;
    entity_type: 'lead' | 'contact' | 'booking' | 'company';
    entity_id: string;
    activity_type: 'created' | 'updated' | 'note' | 'email' | 'call';
    description: string;
    user_id: string | null;
    created_at: string;
  };
};
