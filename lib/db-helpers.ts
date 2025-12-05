import { supabase } from './supabase';

export async function getLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*, assigned_to_user:users!assigned_to(full_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
  return data || [];
}

export async function getCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*, users(full_name)')
    .order('name');

  if (error) throw error;
  return data;
}

export async function getContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, companies(name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('code');

  if (error) throw error;
  return data;
}

export async function getCourseRuns() {
  const { data, error } = await supabase
    .from('course_runs')
    .select('*, courses(*)')
    .order('start_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      contacts(*),
      companies(name),
      course_runs(*, courses(*))
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getTasks(userId?: string) {
  let query = supabase
    .from('tasks')
    .select('*, users(full_name)')
    .order('due_date', { ascending: true });

  if (userId) {
    query = query.eq('assigned_to', userId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getActivities(entityType: string, entityId: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*, users(full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function searchGlobal(query: string) {
  const searchTerm = `%${query}%`;

  const [leads, contacts, companies, bookings] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, company_name, email')
      .or(`name.ilike.${searchTerm},company_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(5),
    supabase
      .from('companies')
      .select('id, name')
      .ilike('name', searchTerm)
      .limit(5),
    supabase
      .from('bookings')
      .select('id, invoice_no, certificate_no')
      .or(`invoice_no.ilike.${searchTerm},certificate_no.ilike.${searchTerm}`)
      .limit(5),
  ]);

  return {
    leads: leads.data || [],
    contacts: contacts.data || [],
    companies: companies.data || [],
    bookings: bookings.data || [],
  };
}

export async function getDashboardMetrics() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [leadsThisWeek, allLeads, upcomingRuns, candidateCourses] = await Promise.all([
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
    supabase
      .from('leads')
      .select('status, source'),
    supabase
      .from('course_runs')
      .select('seats_total, seats_booked')
      .gte('start_date', now.toISOString().split('T')[0])
      .lte('start_date', thirtyDaysAhead.toISOString().split('T')[0]),
    supabase
      .from('candidate_courses')
      .select('result')
      .in('result', ['passed', 'failed']),
  ]);

  if (leadsThisWeek.error) console.error('Error fetching leadsThisWeek:', leadsThisWeek.error);
  if (allLeads.error) console.error('Error fetching allLeads:', allLeads.error);
  if (upcomingRuns.error) console.error('Error fetching upcomingRuns:', upcomingRuns.error);
  if (candidateCourses.error) console.error('Error fetching candidateCourses:', candidateCourses.error);

  const totalLeads = allLeads.data?.length || 0;
  const wonLeads = allLeads.data?.filter(l => l.status === 'won').length || 0;
  const conversion = totalLeads > 0 ? (wonLeads / totalLeads * 100).toFixed(1) : '0';

  // Email imported leads statistics (from email upload button - Google Ads)
  const emailLeads = allLeads.data?.filter(l => l.source === 'email_import') || [];
  const emailWon = emailLeads.filter(l => l.status === 'won').length;
  const emailConversion = emailLeads.length > 0 ? (emailWon / emailLeads.length * 100).toFixed(1) : '0';

  // Manual leads statistics (entered through UI: email, phone, referral)
  const manualLeads = allLeads.data?.filter(l => l.source === 'email' || l.source === 'phone' || l.source === 'referral' || l.source === 'web' || l.source === 'manual') || [];
  const manualWon = manualLeads.filter(l => l.status === 'won').length;
  const manualConversion = manualLeads.length > 0 ? (manualWon / manualLeads.length * 100).toFixed(1) : '0';

  const totalSeats = upcomingRuns.data?.reduce((sum, run) => sum + run.seats_total, 0) || 0;
  const bookedSeats = upcomingRuns.data?.reduce((sum, run) => sum + run.seats_booked, 0) || 0;

  const totalCompleted = candidateCourses.data?.length || 0;
  const passedCourses = candidateCourses.data?.filter(c => c.result === 'passed').length || 0;
  const passRate = totalCompleted > 0 ? (passedCourses / totalCompleted * 100).toFixed(1) : '0';

  return {
    leadsThisWeek: leadsThisWeek.count || 0,
    conversionRate: conversion,
    seatsFilled: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
    passRate: passRate,
    emailLeads: {
      total: emailLeads.length,
      won: emailWon,
      conversion: emailConversion,
    },
    manualLeads: {
      total: manualLeads.length,
      won: manualWon,
      conversion: manualConversion,
    },
  };
}
