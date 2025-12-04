# CRM Database Migration Instructions

## Overview
Your application is now configured to use the CRM Supabase project (tsveamhlzjueeptkqkcx.supabase.co).

All 87 migrations have been combined into a single file: `combined_migrations.sql` (232KB, 7375 lines).

## Migration Status

### ✅ Completed
- Switched application to use CRM credentials in `lib/supabase.ts`
- Compiled all 87 migrations in chronological order

### 🔄 Next Steps

#### Option 1: Execute via Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard
2. Select your CRM project (tsveamhlzjueeptkqkcx)
3. Navigate to SQL Editor
4. Copy the contents of `combined_migrations.sql`
5. Paste and execute

#### Option 2: Execute via CLI
```bash
# If you have Supabase CLI installed
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.tsveamhlzjueeptkqkcx.supabase.co:5432/postgres" --file combined_migrations.sql
```

## Migration Details

The combined migration includes all 87 individual migrations:
- Core schema (users, companies, contacts, leads, courses, bookings, tasks)
- Candidates and training sessions
- Booking forms and notifications
- Notes and AI extraction
- Attendance tracking
- Marketing campaigns
- Trainers and certifications
- Calendar settings
- All RLS policies and triggers

## After Migration

Once migrations are executed:
1. Run the seed data script: `scripts/seed-data.sql`
2. Verify the build with: `npm run build`
3. Test the application

## Files Created
- `/tmp/cc-agent/58951546/project/combined_migrations.sql` - All migrations combined
- `/tmp/cc-agent/58951546/project/apply-all-migrations.sh` - Helper script
