/*
  # Multi-Tenancy Access Control Documentation

  This migration documents the complete access control model for the CRM system.

  ## User-Specific Data (Private per user)

  ### Leads
  - Users can only see leads assigned to them via `assigned_to` field
  - Admins can see all leads
  - When a sales user creates a lead, they're automatically assigned to it
  - Notes on leads follow the same access rules

  ### Tasks  
  - Users can only see tasks assigned to them via `assigned_to` field
  - Admins can see all tasks
  - Already correctly configured in initial schema

  ### Notes (Context-Aware)
  - Notes on leads: only visible to users with access to that lead
  - Notes on shared entities: visible to all authenticated users

  ## Shared Data (Accessible by all authenticated users)

  ### Companies
  - All authenticated users can view companies
  - Sales and admins can create/update companies
  - Only admins can delete companies

  ### Contacts
  - All authenticated users can view contacts
  - Sales and admins can create/update contacts
  - Only admins can delete contacts

  ### Candidates
  - All authenticated users can view candidates
  - Sales and admins can create/update candidates
  - Only admins can delete candidates

  ### Courses & Course Runs
  - All authenticated users can view courses and course runs
  - Sales and admins can create/update course runs
  - Only admins can create/update/delete courses

  ### Bookings
  - All authenticated users can view bookings
  - Sales and admins can create/update bookings
  - Only admins can delete bookings

  ### Training Sessions & Attendance
  - All authenticated users can view training sessions and attendance
  - Sales and admins can create/update records
  - Only admins can delete records

  ## Implementation Notes

  - The `assigned_to` field determines ownership for leads and tasks
  - The `created_by` field tracks who created a record but doesn't control access
  - Admins always have full access to all data
  - Sales users have write access to operational data but not configuration data
*/

-- This migration is documentation-only and makes no schema changes
SELECT 'Multi-tenancy access control model documented' AS status;
