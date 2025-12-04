# CPTS Training CRM - Setup Instructions

## Overview

This is a complete CRM system for Construction & Plant Training Services (CPTS), a UK-based company offering machinery training courses.

## Tech Stack

- **Frontend**: Next.js 13 (App Router), React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (PostgreSQL database, Authentication, Row Level Security)
- **State Management**: React Context API
- **Date Handling**: date-fns
- **Form Validation**: Zod + react-hook-form

## Prerequisites

- Node.js 18+ installed
- A Supabase account and project

## Setup Steps

### 1. Database Setup

The database migration file is located at `supabase/migrations/20250101000000_init_schema.sql`.

You have two options to apply the migration:

**Option A: Using Supabase Dashboard (Recommended)**
1. Log in to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the entire contents of `supabase/migrations/20250101000000_init_schema.sql`
4. Paste into the SQL Editor and run it
5. Verify all tables were created successfully

**Option B: Using Supabase CLI**
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link your project (you'll need your project ref)
supabase link --project-ref your-project-ref

# Push the migration
supabase db push
```

### 2. Seed Demo Data (Optional)

To populate the database with sample data for testing:

1. Open the Supabase SQL Editor
2. Copy the contents of `scripts/seed-data.sql`
3. Paste and run in the SQL Editor

**Note**: Seed data includes:
- 5 training courses (Excavator, Telehandler, Forklift, MEWP, Supervisor)
- 4 companies
- 10 contacts
- 8 leads across different pipeline stages
- 5 upcoming course runs
- 5 bookings with various statuses

### 3. Create First Admin User

1. Start the development server: `npm run dev`
2. Open http://localhost:3000 in your browser
3. Click "First time? Create admin account"
4. Fill in your details:
   - Full Name
   - Email address
   - Password (minimum 6 characters)
5. Click "Create Admin Account"
6. After account creation, sign in with your credentials

### 4. Environment Variables

The `.env` file should already contain your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These are automatically configured and should work out of the box.

## Features

### Core Functionality

1. **Dashboard**
   - Metrics: Leads this week, conversion rate, seats filled
   - Today's tasks panel
   - Upcoming course sessions
   - Recent leads

2. **Leads Pipeline**
   - Kanban board view with drag-and-drop (manual for MVP)
   - List view
   - Status stages: New → Contacted → Qualified → Proposal → Won → Lost
   - Full lead management with GDPR consent tracking

3. **Companies**
   - Client company records
   - Registration numbers, VAT numbers
   - Full address details

4. **Contacts**
   - Individual trainees and contacts
   - Link to companies
   - Language preference (EN/PL)
   - GDPR consent tracking

5. **Courses**
   - Training course catalog
   - Categories: Excavator, Telehandler, Forklift, MEWP, Supervisor
   - Accreditation tracking (CPCS, NPORS, IPAF, ETC)
   - Pricing and duration

6. **Course Runs**
   - Scheduled training sessions
   - Seat availability tracking
   - Location and trainer assignment

7. **Bookings**
   - Course registrations
   - Status tracking: Reserved → Confirmed → Completed → Cancelled
   - Invoice and certificate number tracking

8. **Tasks**
   - Action item tracking
   - Due date management
   - Assignment to users
   - Quick status toggle (Open/Done)

9. **Settings**
   - CSV export (Leads, Contacts, Bookings)
   - CSV import for leads
   - GDPR tools

### User Roles & Permissions

The system supports three roles with different access levels:

1. **Admin**
   - Full access to all features
   - User management
   - Can delete records
   - System settings

2. **Sales**
   - Manage leads, companies, contacts
   - Create and manage bookings
   - View courses and runs
   - Manage own tasks

3. **Trainer**
   - View assigned course runs
   - View trainee information
   - Limited access to other features

### Security Features

- Row Level Security (RLS) enabled on all tables
- Role-based access control
- GDPR consent tracking on leads and contacts
- Secure authentication with Supabase Auth
- Password requirements enforced

## Project Structure

```
/app
  /page.tsx          # Dashboard
  /leads/page.tsx    # Leads pipeline
  /companies/        # Companies management
  /contacts/         # Contacts management
  /courses/          # Course catalog
  /runs/             # Course runs/sessions
  /bookings/         # Booking management
  /tasks/            # Task management
  /settings/         # System settings

/components
  /ui/              # shadcn/ui components
  /app-shell.tsx    # Main app wrapper with auth
  /app-nav.tsx      # Navigation sidebar
  /lead-dialog.tsx  # Lead create/edit form
  /company-dialog.tsx # Company create/edit form

/lib
  /supabase.ts      # Supabase client setup
  /auth-context.tsx # Authentication context
  /db-helpers.ts    # Database query functions
  /utils.ts         # Utility functions

/supabase/migrations
  # Database schema migrations

/scripts
  # Seed data and utility scripts
```

## Usage Tips

### Creating Your First Lead

1. Navigate to Leads page
2. Click "Add Lead" button
3. Fill in the required information:
   - Name (required)
   - Company name, email, phone
   - Select training interests (checkbox list)
   - Choose preferred language
   - Add any notes
4. Check GDPR consent if provided
5. Click "Create Lead"

### Booking a Course

1. Navigate to Bookings page
2. Click "New Booking"
3. Select a course run
4. Choose or create a contact
5. Select company (optional)
6. Set amount and status
7. Save the booking

### Exporting Data

1. Go to Settings page
2. Under "Export Data", click the relevant export button
3. CSV file will download automatically

### Importing Leads

1. Go to Settings page
2. Under "Import Leads", prepare your CSV file with headers:
   `name,company_name,email,phone,source,channel,training_interest,preferred_language,location,notes`
3. Training interests should be semicolon-separated (e.g., "Excavator;Forklift")
4. Select your CSV file
5. Import will process automatically

## Troubleshooting

### Database Connection Issues

If you see database errors:
1. Check your `.env` file has correct Supabase credentials
2. Verify your Supabase project is active
3. Check the database migration was applied successfully

### Authentication Issues

If you can't sign in:
1. Verify email/password are correct
2. Check that a user profile was created in the `users` table
3. Ensure your Supabase Auth is enabled

### RLS Policy Errors

If you see "permission denied" errors:
1. Verify your user has a profile in the `users` table
2. Check the user's role is set correctly
3. Review RLS policies in the migration file

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type check
npm run typecheck

# Lint code
npm run lint
```

## Production Deployment

1. Build the application: `npm run build`
2. Ensure all environment variables are set in your hosting platform
3. Deploy using your preferred hosting (Vercel, Netlify, etc.)
4. Verify database connection works in production

## Support & Customization

This MVP provides a solid foundation. Key areas for future enhancement:

- Real-time updates using Supabase subscriptions
- Email/SMS notifications
- Advanced reporting and analytics
- Payment processing integration
- Certificate generation
- Document management
- Advanced search and filtering
- Calendar view for course runs
- Mobile app version

## License

Proprietary - CPTS Training Services
